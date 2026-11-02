#!/usr/bin/env python3
"""Offline system librsvg/cairo only. No package install, browser, or sockets."""
import ctypes as C
import pathlib
import sys
rsvg=C.CDLL('librsvg-2.so.2'); cairo=C.CDLL('libcairo.so.2'); obj=C.CDLL('libgobject-2.0.so.0')
rsvg.rsvg_handle_new_from_data.argtypes=[C.c_void_p,C.c_size_t,C.c_void_p];rsvg.rsvg_handle_new_from_data.restype=C.c_void_p
rsvg.rsvg_handle_render_cairo.argtypes=[C.c_void_p,C.c_void_p];rsvg.rsvg_handle_render_cairo.restype=C.c_int
cairo.cairo_image_surface_create.argtypes=[C.c_int,C.c_int,C.c_int];cairo.cairo_image_surface_create.restype=C.c_void_p
cairo.cairo_create.argtypes=[C.c_void_p];cairo.cairo_create.restype=C.c_void_p
cairo.cairo_surface_write_to_png.argtypes=[C.c_void_p,C.c_char_p];cairo.cairo_surface_write_to_png.restype=C.c_int
cairo.cairo_destroy.argtypes=[C.c_void_p];cairo.cairo_surface_destroy.argtypes=[C.c_void_p];obj.g_object_unref.argtypes=[C.c_void_p]
for file in sorted(pathlib.Path(sys.argv[1]).glob('*.svg')):
 data=file.read_bytes();handle=rsvg.rsvg_handle_new_from_data(data,len(data),None)
 if not handle: raise RuntimeError(f'Cannot parse {file}')
 surface=cairo.cairo_image_surface_create(0,1280,720);context=cairo.cairo_create(surface)
 if not rsvg.rsvg_handle_render_cairo(handle,context):raise RuntimeError(f'Cannot render {file}')
 if cairo.cairo_surface_write_to_png(surface,str(file.with_suffix('.png')).encode()):raise RuntimeError(f'Cannot write {file}')
 cairo.cairo_destroy(context);cairo.cairo_surface_destroy(surface);obj.g_object_unref(handle)
print('Rasterized',len(list(pathlib.Path(sys.argv[1]).glob('*.png'))),'frames using installed librsvg/cairo')
