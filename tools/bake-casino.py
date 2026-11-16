"""Real Cycles diffuse lightmaps for the existing casino.
Preview: --preview --surfaces (1024 square, 8 samples).
Production: --production --surfaces (4096 square, 256 samples).
Albedo and view-dependent reflections remain separate from the light atlas.
"""
import bpy, bmesh, sys, pathlib, json, math, hashlib, time, runpy
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1]
source_hash=hashlib.sha256((ROOT/'assets/source/bake/scene.json').read_bytes()).hexdigest()
layout_hash=hashlib.sha256((ROOT/'assets/source/bake/layout.json').read_bytes()).hexdigest()
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
production='--production' in args; full_static='--surfaces' in args
width,height,samples=(4096,4096,256) if production and full_static else (1024,1024,8) if full_static else (1536,2048,96) if production else (192,256,8)
output=ROOT/('public/assets/lighting' if production else 'test-results/bake-preview')
inspection=ROOT/('test-results/bake-production' if production else 'test-results/bake-preview')
output.mkdir(parents=True,exist_ok=True);inspection.mkdir(parents=True,exist_ok=True)
(output/'manifest.json').unlink(missing_ok=True)
namespace=runpy.run_path(str(ROOT/'tools/bake-casino-source.py'))
imported=runpy.run_path(str(ROOT/'tools/import-bake-scene.py'),init_globals={'FULL_STATIC':full_static})
scene=bpy.context.scene;device_description='CPU'
preferences=bpy.context.preferences.addons['cycles'].preferences
for backend in ('OPTIX','CUDA'):
    try:
        preferences.compute_device_type=backend;preferences.get_devices()
        gpu=[d for d in preferences.devices if d.type==backend]
        if gpu:
            for device in preferences.devices:device.use=device in gpu
            scene.cycles.device='GPU';device_description=backend+': '+', '.join(d.name for d in gpu);break
    except Exception as error:print('GPU discovery:',backend,str(error),flush=True)
print('Cycles device:',device_description,flush=True)
scene.cycles.samples=samples
scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True
scene.render.bake.use_pass_color=False;scene.render.bake.margin=max(1,round(width*4/4096))
scene.render.bake.use_clear=True;scene.render.bake.margin_type='EXTEND'
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_depth='8'
scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=False
bpy.ops.object.select_all(action='DESELECT');uv_manifest=None
if full_static:
    receivers=[o for o in imported['imported'] if o.get('bake_receiver')]
    if not receivers:raise RuntimeError('No static diffuse receivers exported')
    for obj in receivers:obj.select_set(True)
    bpy.context.view_layer.objects.active=receivers[0]
    bpy.ops.object.join();receiver=bpy.context.object;receiver.name='BAKE_static_diffuse'
    # A common atlas preserves runtime draw batching. Unwrap keeps face IDs.
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    # glTF/render batches duplicate vertices along every triangle. Weld only
    # coincident positions so planar walls become islands rather than postage
    # stamps surrounded by padding. FACE source IDs survive this operation.
    bpy.ops.mesh.remove_doubles(threshold=.00001)
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=0,area_weight=.25,
        correct_aspect=True,scale_to_bounds=True)
    # Walkable floors are continuously inspected at close range. Allocate extra
    # light texels to their whole islands before the final common-atlas pack.
    floor_ids={r['sourceIndex'] for r in imported['receiver_records']
        if r['materialName'].startswith(('Honed ivory marble','Woven Deco wool'))}
    edit=bmesh.from_edit_mesh(receiver.data);uv_layer=edit.loops.layers.uv.active
    source_layer=edit.faces.layers.int['source_mesh']
    for face in edit.faces:
        if face[source_layer] in floor_ids:
            for loop in face.loops:loop[uv_layer].uv*=1.5
    bmesh.update_edit_mesh(receiver.data)
    bpy.ops.uv.pack_islands(rotate=True,margin_method='FRACTION',margin=8/4096)
    bpy.ops.object.mode_set(mode='OBJECT')
    mesh=receiver.data;mesh.uv_layers.active.name='CasinoLightUV'
    records={v['sourceIndex']:{**v,'uv':[0.0]*(v['triangleCount']*6)} for v in imported['receiver_records']}
    source_mesh=mesh.attributes['source_mesh'];source_triangle=mesh.attributes['source_triangle']
    source_corner=mesh.attributes['source_corner']
    for face in mesh.polygons:
        record=records[source_mesh.data[face.index].value]
        offset=source_triangle.data[face.index].value*6
        for loop in face.loop_indices:
            j=source_corner.data[loop].value
            uv=mesh.uv_layers.active.data[loop].uv
            record['uv'][offset+j*2]=round(float(uv.x),8)
            record['uv'][offset+j*2+1]=round(float(uv.y),8)
    uv_manifest={'version':1,'meshes':list(records.values())}
    uv_area=0.0
    for record in records.values():
        u=record['uv']
        record_area=0.0
        for i in range(0,len(u),6):
            record_area+=abs((u[i+2]-u[i])*(u[i+5]-u[i+1])-(u[i+4]-u[i])*(u[i+3]-u[i+1]))/2
        uv_area+=record_area
        record['texelsPerMetre']=4096*math.sqrt(record_area/max(.000001,record['worldArea']))
        if record['materialName'].startswith(('Honed ivory marble','Woven Deco wool')) and record['texelsPerMetre']<16:
            raise RuntimeError(f"Floor lightmap density too low: {record['texelsPerMetre']:.1f} texels/metre")
    if uv_area<.25:raise RuntimeError(f'UV packing wastes atlas space: coverage {uv_area:.3%}')
    uv_path=output/'static-uv.json';uv_path.write_text(json.dumps(uv_manifest,separators=(',',':')))
    print('UV atlas ready:',len(records),'meshes,',len(mesh.polygons),'triangles, coverage',uv_area,flush=True)
else:
    receiver=bpy.data.objects['BAKE_floor'];receiver.select_set(True);bpy.context.view_layer.objects.active=receiver
image=bpy.data.images.new('Diffuse irradiance',width=width,height=height,alpha=True,float_buffer=True)
image.colorspace_settings.name='Non-Color';image.alpha_mode='CHANNEL_PACKED'
for material in receiver.data.materials:
    node=material.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
    material.node_tree.nodes.active=node
denoise=runpy.run_path(str(ROOT/'tools/oidn-lightmap.py'))['denoise_rgb']
# Object transform is identity after the exact world-space import and join, so
# this noise-free object-space normal pass is also world-space OIDN guidance.
scene.render.bake.normal_space='OBJECT';scene.cycles.samples=1
bpy.ops.object.bake(type='NORMAL')
normal_pixels=np.empty(width*height*4,dtype=np.float32);image.pixels.foreach_get(normal_pixels)
normal_pixels=normal_pixels.reshape((-1,4))
normal=np.ascontiguousarray(normal_pixels[:,:3]*2-1)
normal[normal_pixels[:,3]<.5]=0
del normal_pixels
scene.cycles.samples=samples
start=time.time();states={};radiance_range=32.0;prefix='static' if full_static else 'floor'
for state in ('emergency','restored'):
    for obj in scene.objects:
        if obj.type=='LIGHT':obj.data.energy=obj['restored_watts']*(1 if state=='restored' else obj['emergency_factor'])
    print('Baking',state,width,height,samples,flush=True)
    bpy.ops.object.bake(type='DIFFUSE')
    pixels=np.empty(width*height*4,dtype=np.float32);image.pixels.foreach_get(pixels)
    pixels=pixels.reshape((-1,4));rgb=np.maximum(0,pixels[:,:3])
    if not np.isfinite(rgb).all():raise RuntimeError(state+' atlas contains nonfinite illumination')
    raw_mean=float(rgb.mean())
    image.filepath_raw=str(inspection/f'{prefix}-{state}-raw.exr');image.file_format='OPEN_EXR';image.save()
    print('Denoising',state,'with clean Cycles normal guidance',flush=True)
    rgb=denoise(rgb,normal,width,height)
    energy_change=abs(float(rgb.mean())-raw_mean)/max(raw_mean,.0001)
    if energy_change>.15:raise RuntimeError(f'Denoiser altered atlas energy by {energy_change:.1%}')
    pixels[:,:3]=rgb;image.pixels.foreach_set(pixels.ravel())
    mean=float(rgb.mean());peak=float(rgb.max());clipped=float((rgb>radiance_range).any(axis=1).mean())
    if mean<.00001 or peak<.001:raise RuntimeError(f'{state} atlas is black: {mean}, {peak}')
    if clipped>.005:raise RuntimeError(f'{state} atlas clips {clipped:.2%} of texels; increase RGBM range')
    encoded=np.empty_like(pixels)
    encoded[:,3]=np.maximum(1/255,np.minimum(1,np.ceil(rgb.max(axis=1)/radiance_range*255)/255))
    encoded[:,:3]=np.clip(rgb/(encoded[:,3:4]*radiance_range),0,1)
    data=bpy.data.images.new('RGBM '+state,width=width,height=height,alpha=True)
    data.colorspace_settings.name='Non-Color';data.alpha_mode='CHANNEL_PACKED';data.pixels.foreach_set(encoded.ravel())
    path=output/f'{prefix}-{state}.png';data.filepath_raw=str(path);data.file_format='PNG';data.save()
    check=bpy.data.images.load(str(path),check_existing=False)
    check.colorspace_settings.name='Non-Color';check.alpha_mode='CHANNEL_PACKED'
    if tuple(check.size)!=(width,height):raise RuntimeError('Saved atlas size mismatch')
    loaded=np.empty(width*height*4,dtype=np.float32);check.pixels.foreach_get(loaded);loaded=loaded.reshape((-1,4))
    decoded=loaded[:,:3]*loaded[:,3:4]*radiance_range
    relative_error=float(np.abs(decoded-np.minimum(rgb,radiance_range)).mean()/max(mean,.0001))
    if relative_error>.035:raise RuntimeError(f'{state} RGBM PNG failed roundtrip: {relative_error}')
    states[state]={'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'mean':mean,
        'peak':peak,'clippedFraction':clipped,'decodedRelativeError':relative_error,'bytes':path.stat().st_size,
        'denoiseEnergyChangeFraction':energy_change}
    bpy.data.images.remove(check);bpy.data.images.remove(data)
    image.filepath_raw=str(inspection/f'{prefix}-{state}-inspection.exr');image.file_format='OPEN_EXR';image.save()
    review=bpy.data.images.new('Atlas review '+state,width=width,height=height,alpha=True)
    review.colorspace_settings.name='Non-Color';review.alpha_mode='CHANNEL_PACKED'
    review_pixels=np.ones_like(pixels);linear=rgb/(1+rgb)
    review_pixels[:,:3]=np.where(linear<=.0031308,linear*12.92,1.055*np.power(linear,1/2.4)-.055)
    review.pixels.foreach_set(review_pixels.ravel());review.filepath_raw=str(inspection/f'{prefix}-{state}-inspection.png')
    review.file_format='PNG';review.save();bpy.data.images.remove(review)
    scene.render.resolution_x=960;scene.render.resolution_y=540
    scene.render.filepath=str(inspection/f'room-{state}-inspection.png');bpy.ops.render.render(write_still=True)
    del pixels,rgb,encoded,loaded,decoded,review_pixels,linear
if states['restored']['mean'] <= states['emergency']['mean']*1.1:
    raise RuntimeError('Restored illumination did not materially differ from emergency')
if hashlib.sha256((ROOT/'assets/source/bake/scene.json').read_bytes()).hexdigest()!=source_hash or hashlib.sha256((ROOT/'assets/source/bake/layout.json').read_bytes()).hexdigest()!=layout_hash:
    raise RuntimeError('Source geometry/layout changed while baking; output must be regenerated')
manifest={'status':'baked','engine':'Blender Cycles','blenderVersion':bpy.app.version_string,
    'device':device_description,'sourceSHA256':source_hash,'layoutSHA256':layout_hash,
    'coverage':'static-diffuse' if full_static else 'floor-only','occluders':scene['bake_coverage'],
    'dimensions':[width,height],'samples':samples,'encoding':'RGBM','range':radiance_range,
    'states':states,'seconds':round(time.time()-start,2),'meshCount':len(imported['data']['meshes']),
    'receiverCount':len(uv_manifest['meshes']) if full_static else 1,
    'triangles':sum(r['triangleCount'] for r in uv_manifest['meshes']) if full_static else len(receiver.data.polygons),'mipPaddingPixels':scene.render.bake.margin,
    'uvOccupiedArea':uv_area if full_static else 1,
    'denoising':{'method':'OpenImageDenoise RT','guidance':'Clean Cycles world-space normals','quality':'high','hdr':True},
    'gpuBytesWithMipmaps':math.ceil(width*height*4*2*4/3),
    'visualInspection':'REQUIRED: inspect both room PNGs and atlas inspection PNGs before shipping'}
if full_static:manifest['meshMap']={'file':uv_path.name,'sha256':hashlib.sha256(uv_path.read_bytes()).hexdigest(),'bytes':uv_path.stat().st_size}
else:manifest['bounds']={'minX':-24,'maxX':24,'minZ':-48,'maxZ':16}
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/source/bake/casino-static-lighting.blend'),compress=True)
(output/'manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2),flush=True)
