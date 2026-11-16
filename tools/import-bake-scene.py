"""Import exact playable world triangles and retain source IDs for Cycles UVs."""
import bpy, pathlib, json, math
ROOT=pathlib.Path(__file__).resolve().parents[1]
source=ROOT/'assets/source/bake/scene.json'
data=json.loads(source.read_text())
full_static=globals().get('FULL_STATIC',False)
if data.get('units')!='metres' or data.get('up')!='Y' or len(data.get('rooms',[]))!=12:
    raise ValueError('Unexpected exported coordinate system or room count')
for obj in list(bpy.context.scene.objects):
    if obj.name.startswith('ENV_') or (full_static and obj.name=='BAKE_floor'):
        bpy.data.objects.remove(obj,do_unlink=True)
materials={}; imported=[]; receiver_records=[]
def geometry_signature(values,indices):
    h=2166136261
    for v in values:
        q=math.floor(v*10000+.5)&0xffffffff
        h=((h^q)*16777619)&0xffffffff
    for index in indices:h=((h^index)*16777619)&0xffffffff
    return format(h,'08x')
for number,record in enumerate(data['meshes']):
    definition=record['material'];name=definition.get('name','unnamed')
    if not full_static and name.startswith(('Honed ivory marble','Woven Deco wool')):continue
    raw=record['positions']
    if len(raw)%3 or not all(math.isfinite(v) for v in raw):
        raise ValueError(f'Malformed position buffer {number}: {name}')
    vertices=[(raw[i],-raw[i+2],raw[i+1]) for i in range(0,len(raw),3)]
    indices=record.get('indices') or list(range(len(vertices)))
    if len(indices)%3 or any(i<0 or i>=len(vertices) for i in indices):
        raise ValueError(f'Malformed index buffer {number}: {name}')
    # Unnamed glTF materials may have different albedos: key the whole definition.
    material_key=json.dumps(definition,sort_keys=True)
    if material_key not in materials:
        material=bpy.data.materials.new('Export '+name);material.use_nodes=True
        node=material.node_tree.nodes['Principled BSDF']
        node.inputs['Base Color'].default_value=(*definition.get('color',(.2,.2,.2)),1)
        node.inputs['Roughness'].default_value=definition.get('roughness',.7)
        node.inputs['Metallic'].default_value=definition.get('metalness',0)
        emission=definition.get('emissive') or (0,0,0)
        node.inputs['Emission Color'].default_value=(*emission,1)
        node.inputs['Emission Strength'].default_value=definition.get('emissiveIntensity',0)
        materials[material_key]=material
    faces=[indices[i:i+3] for i in range(0,len(indices),3)]
    mesh=bpy.data.meshes.new('Export mesh '+str(number));mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new('ENV_exact_'+str(number),mesh);bpy.context.scene.collection.objects.link(obj)
    mesh.materials.append(materials[material_key]);imported.append(obj)
    if full_static:
        emission=max(definition.get('emissive') or [0])*definition.get('emissiveIntensity',0)
        area=sum(face.area for face in mesh.polygons)
        # Chips, buttons and narrow upholstery piping can have 30,000 triangles
        # in one square metre. They remain exact occluders with live lighting;
        # reserving atlas area for walkable surfaces and cabinetry gives those
        # inspectable surfaces useful lighting resolution instead of UV padding.
        receiver=(definition.get('standard',True) and definition.get('metalness',0)<.82
            and emission<.8 and area>.02 and area/max(1,len(faces))>=.003)
        if receiver:
            source_mesh=mesh.attributes.new('source_mesh','INT','FACE')
            source_triangle=mesh.attributes.new('source_triangle','INT','FACE')
            source_corner=mesh.attributes.new('source_corner','INT','CORNER')
            for face in mesh.polygons:
                source_mesh.data[face.index].value=number
                source_triangle.data[face.index].value=face.index
                for j,loop in enumerate(face.loop_indices):source_corner.data[loop].value=j
            obj['bake_receiver']=True
            receiver_records.append({'sourceIndex':number,'bakeId':record.get('bakeId',number),
                'vertexCount':len(vertices),'indexCount':len(record.get('indices') or []),
                'triangleCount':len(faces),'worldArea':area,'materialName':name,
                'geometrySignature':record.get('geometrySignature') or geometry_signature(raw,record.get('indices') or [])})
bpy.context.scene['bake_coverage']='Exact exported opaque static geometry; moving shutters, actors, particles and glass excluded'
print('Imported',len(imported),'exact mesh records;',len(receiver_records),'diffuse receivers',flush=True)
