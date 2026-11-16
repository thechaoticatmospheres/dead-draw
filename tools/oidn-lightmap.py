"""Open Image Denoise on Cycles lightmaps, using Blender's bundled CPU library.
API: https://www.openimagedenoise.org/documentation.html
Normal guidance preserves atlas boundaries; no albedo or reflections are added.
"""
import ctypes as C, pathlib, bpy, numpy as np

def denoise_rgb(rgb, normal, width, height):
    folder=pathlib.Path(bpy.app.binary_path).parent
    candidates=list(folder.glob('blender.shared/OpenImageDenoise.dll'))+list(folder.glob('lib/libOpenImageDenoise.so*'))+list(folder.glob('../Resources/lib/libOpenImageDenoise*.dylib'))
    if not candidates:raise RuntimeError('Blender bundled OpenImageDenoise library unavailable')
    api=C.CDLL(str(candidates[0]))
    def signature(name, result, args):
        function=getattr(api,name);function.restype=result;function.argtypes=args;return function
    new_device=signature('oidnNewDevice',C.c_void_p,[C.c_int])
    commit_device=signature('oidnCommitDevice',None,[C.c_void_p])
    new_filter=signature('oidnNewFilter',C.c_void_p,[C.c_void_p,C.c_char_p])
    set_image=signature('oidnSetSharedFilterImage',None,[C.c_void_p,C.c_char_p,C.c_void_p,C.c_int,C.c_size_t,C.c_size_t,C.c_size_t,C.c_size_t,C.c_size_t])
    set_bool=signature('oidnSetFilterBool',None,[C.c_void_p,C.c_char_p,C.c_bool])
    commit_filter=signature('oidnCommitFilter',None,[C.c_void_p])
    execute=signature('oidnExecuteFilter',None,[C.c_void_p])
    get_error=signature('oidnGetDeviceError',C.c_int,[C.c_void_p,C.POINTER(C.c_char_p)])
    release_filter=signature('oidnReleaseFilter',None,[C.c_void_p])
    release_device=signature('oidnReleaseDevice',None,[C.c_void_p])
    color=np.ascontiguousarray(rgb,dtype=np.float32)
    guide=np.ascontiguousarray(normal,dtype=np.float32)
    # OIDN's guided RT model expects both albedo and normals. This image is
    # illumination with material albedo deliberately removed: white is the
    # correct albedo guide, with black outside occupied atlas gutters.
    albedo=np.ones_like(color)
    albedo[np.max(np.abs(guide),axis=1)<.001]=0
    output=np.empty_like(color)
    device=new_device(1) # OIDN_DEVICE_TYPE_CPU supports shared numpy host buffers.
    filter=None
    def check():
        message=C.c_char_p()
        if get_error(device,C.byref(message)):
            raise RuntimeError('OpenImageDenoise: '+(message.value or b'unknown error').decode())
    try:
        if not device:raise RuntimeError('OpenImageDenoise CPU device unavailable')
        commit_device(device);check();filter=new_filter(device,b'RT')
        for name,array in ((b'color',color),(b'albedo',albedo),(b'normal',guide),(b'output',output)):
            set_image(filter,name,array.ctypes.data,3,width,height,0,0,0) # OIDN_FORMAT_FLOAT3
        set_bool(filter,b'hdr',True);set_bool(filter,b'cleanAux',True)
        commit_filter(filter);check();execute(filter);check()
        if not np.isfinite(output).all():raise RuntimeError('Denoiser produced nonfinite illumination')
        # Preserve completely unoccupied gutters; normal=0 outside the UV mask.
        output[np.max(np.abs(guide),axis=1)<.001]=0
        return np.maximum(output,0)
    finally:
        if filter:release_filter(filter)
        if device:release_device(device)
