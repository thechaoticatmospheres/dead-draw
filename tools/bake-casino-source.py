"""Reproducible light-transport source, from export-bake-layout.mjs.

Native Blender: blender --background --python tools/bake-casino-source.py
Only room shells, structural trim and static collision envelopes are baked.
Movable shutters, enemies, prize wheels and particles never occlude the bake.
Coordinates are transformed exactly from Three (x,y,z) to Blender (x,-z,y).
"""
import bpy, math, json, pathlib
from mathutils import Vector

if 'LAYOUT' not in globals():
    LAYOUT = json.loads((pathlib.Path(__file__).resolve().parents[1] / 'assets/source/bake/layout.json').read_text())

scene = bpy.context.scene
for o in list(scene.objects):
    bpy.data.objects.remove(o, do_unlink=True)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 8
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 5
scene.cycles.diffuse_bounces = 4
scene.cycles.glossy_bounces = 2
scene.world = bpy.data.worlds.new('Casino night')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.13,.17,.24,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .025
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1

def mat(name, color, rough=.7, metal=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    return m
materials={
    'floor': mat('Neutral irradiance receiver',(.65,.65,.65)),
    'wall': mat('Deep malachite plaster',(.065,.10,.088)),
    'wood': mat('Oxidized lacquered walnut',(.12,.052,.032),.42),
    'ceiling': mat('Warm ivory ceiling',(.42,.35,.25)),
    'brass': mat('Brushed brass',(.37,.24,.075),.4,.7),
    'felt': mat('Casino green felt',(.04,.14,.09),.96),
}
def box(name,x,y,z,w,h,d,material):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y))
    o=bpy.context.object;o.name=name;o.dimensions=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(materials[material]);return o
def point(name,x,y,z,power,color,radius=.5,emergency=.4):
    light=bpy.data.lights.new(name,'POINT');light.energy=power;light.color=color;light.shadow_soft_size=radius
    o=bpy.data.objects.new(name,light);scene.collection.objects.link(o);o.location=(x,-z,y)
    o['restored_watts']=power;o['emergency_factor']=emergency;return o
def rgb(n):
    # sRGB scalar to scene-linear, matching Three's Color(hex).
    a=[((n>>s)&255)/255 for s in (16,8,0)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in a)

# One continuous receiver means zero per-room seams and one sampler per state.
mesh=bpy.data.meshes.new('Whole floor receiver geometry')
mesh.from_pydata([(-24,-16,.018),(24,-16,.018),(24,48,.018),(-24,48,.018)],[],[(0,1,2,3)])
mesh.update();floor=bpy.data.objects.new('BAKE_floor',mesh);scene.collection.objects.link(floor)
floor.data.materials.append(materials['floor'])
uv=mesh.uv_layers.new(name='BakeUV')
for i,coord in enumerate(((0,0),(1,0),(1,1),(0,1))):uv.data[i].uv=coord

for i,w in enumerate(LAYOUT['walls']):
    box(f'ENV_wall_{i}',w['x'],w['h']/2,w['z'],w['w'],w['h'],w['d'],'wall')
    box(f'ENV_wainscot_{i}',w['x'],.68,w['z'],w['w']+.03,1.04,w['d']+.03,'wood')
    for y in (.13,1.25,3.25,4.98):
        box(f'ENV_brass_{i}_{y}',w['x'],y,w['z'],w['w']+.04,.065,w['d']+.04,'brass')

for r in LAYOUT['rooms']:
    x,z=r['x'],r['z']
    box('ENV_ceiling_'+r['id'],x,5.3,z,15.9,.15,15.9,'ceiling')
    # Match src/render/casino-lighting.js: one 45/100-intensity chandelier,
    # 24/44 spot downlight, four 4/10-intensity sconces. Point flux = 4*pi*I.
    color=rgb(0xd9c2e9 if r['id']=='neon' else 0xd0d9e7 if r['id']=='sapphire' else 0xffd1a0)
    point('LGT_chandelier_'+r['id'],x,4.4,z,100*4*math.pi,color,.45,.45)
    spot=point('LGT_downlight_'+r['id'],x,4.55,z,44*math.pi,rgb(0xffd6a5),.5,24/44)
    spot.data.type='SPOT';spot.data.spot_size=2*1.18;spot.data.spot_blend=.85
    for dx,dz in ((-6.8,0),(6.8,0),(0,-6.8),(0,6.8)):
        point('LGT_sconce_'+r['id']+str((dx,dz)),x+dx,2.7,z+dz,10*4*math.pi,rgb(0xffcb91),.22,.4)

for s in LAYOUT['stations']:
    point('LGT_station_'+s['id'],s['x'],2.55,s['z']+.5,9*4*math.pi,rgb(s['color']),.65,1)

for i,o in enumerate(LAYOUT['obstacles']):
    # Relocating prize-wheel pads (h=.5) are deliberately not baked occluders.
    if o.get('h',1)<.75:continue
    r=o['r'];h=o.get('h',1)
    if o.get('id')=='cashier':
        box('ENV_cashier_envelope',o['x'],h/2,o['z'],r*1.55,h,1.2,'wood')
    elif o.get('id')=='jukebox':
        box('ENV_jukebox_envelope',o['x'],h/2,o['z'],1.25,h,.7,'wood')
    elif h>3:
        bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r*.75,depth=h,location=(o['x'],-o['z'],h/2))
        q=bpy.context.object;q.name='ENV_column_'+str(i);q.data.materials.append(materials['ceiling'])
    elif h>2.7:
        box('ENV_cabinet_'+str(i),o['x'],1.3,o['z'],2.2,2.6,.8,'wood')
    else:
        # Open space below tables transmits light: tabletops and pedestal only.
        box('ENV_tabletop_'+str(i),o['x'],h-.08,o['z'],r*1.6,.16,r*1.15,'felt')
        box('ENV_pedestal_'+str(i),o['x'],h/2,o['z'],.6,h,.6,'wood')
point('LGT_cashier',4.8,2.7,2.6,95,(1,.78,.47),.6,.8)
point('LGT_jukebox',-5.7,1.7,2.8,60,(1,.24,.055),.5,.7)

camdata=bpy.data.cameras.new('CAM_bake_audit');cam=bpy.data.objects.new('CAM_bake_audit',camdata)
scene.collection.objects.link(cam);cam.location=(4,-14,2.7)
cam.rotation_euler=(Vector((0,-5,1.6))-cam.location).to_track_quat('-Z','Y').to_euler()
camdata.lens=24;scene.camera=cam
scene.render.resolution_x=768;scene.render.resolution_y=432;scene.render.resolution_percentage=100
scene['layout_rooms']=len(LAYOUT['rooms']);scene['layout_walls']=len(LAYOUT['walls'])
scene['bake_coverage']='Floor irradiance; actual structural partitions, static collision envelopes, no movable shutters'
result={'engine':scene.render.engine,'room_count':len(LAYOUT['rooms']),'wall_count':len(LAYOUT['walls']),'objects':len(scene.objects),'floor_dimensions':list(floor.dimensions),'coverage':scene['bake_coverage']}
