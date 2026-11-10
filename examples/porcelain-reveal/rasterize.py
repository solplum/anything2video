#!/usr/bin/env python3
"""Rasterize original shared-core SVGs with system librsvg/cairo. No downloaded code."""
import ctypes as C
from pathlib import Path
import sys
rsvg=C.CDLL('librsvg-2.so.2');cairo=C.CDLL('libcairo.so.2');gobject=C.CDLL('libgobject-2.0.so.0')
rsvg.rsvg_handle_new_from_data.argtypes=[C.c_void_p,C.c_size_t,C.c_void_p];rsvg.rsvg_handle_new_from_data.restype=C.c_void_p
rsvg.rsvg_handle_render_cairo.argtypes=[C.c_void_p,C.c_void_p];rsvg.rsvg_handle_render_cairo.restype=C.c_int
cairo.cairo_image_surface_create.argtypes=[C.c_int,C.c_int,C.c_int];cairo.cairo_image_surface_create.restype=C.c_void_p
cairo.cairo_create.argtypes=[C.c_void_p];cairo.cairo_create.restype=C.c_void_p
cairo.cairo_surface_write_to_png.argtypes=[C.c_void_p,C.c_char_p];cairo.cairo_surface_write_to_png.restype=C.c_int
cairo.cairo_destroy.argtypes=[C.c_void_p];cairo.cairo_surface_destroy.argtypes=[C.c_void_p];gobject.g_object_unref.argtypes=[C.c_void_p]
folder=Path(sys.argv[1]);width=int(sys.argv[2]);height=int(sys.argv[3])
def render(file):
 data=file.read_bytes();handle=rsvg.rsvg_handle_new_from_data(data,len(data),None)
 if not handle:raise RuntimeError('Invalid SVG: '+str(file))
 surface=cairo.cairo_image_surface_create(0,width,height);context=cairo.cairo_create(surface)
 try:
  if not rsvg.rsvg_handle_render_cairo(handle,context):raise RuntimeError('Render failed: '+str(file))
  if cairo.cairo_surface_write_to_png(surface,str(file.with_suffix('.png')).encode()):raise RuntimeError('PNG write failed')
 finally:
  cairo.cairo_destroy(context);cairo.cairo_surface_destroy(surface);gobject.g_object_unref(handle)
if __name__ == '__main__':
 from multiprocessing import Pool
 files=sorted(folder.glob('*.svg'))
 with Pool(3) as pool:pool.map(render,files)
 print('Rasterized',len(files),'shared-core SVG frames')
