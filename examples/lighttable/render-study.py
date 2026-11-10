#!/usr/bin/env python3
"""Capture the exact shared SVG renderer in Chromium; not a Remotion certification.
Requires Python Playwright, Pillow, Chromium and ffmpeg. Outputs stay outside repo.
"""
import argparse, asyncio, functools, http.server, json, pathlib, shutil, subprocess, threading
from PIL import Image, ImageOps, ImageDraw
from playwright.async_api import async_playwright

ROOT=pathlib.Path(__file__).resolve().parents[2]
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

async def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('output',type=pathlib.Path)
    parser.add_argument('--browser',default=shutil.which('chromium'))
    parser.add_argument('--stills-only',action='store_true')
    args=parser.parse_args()
    out=args.output.resolve()
    if out==ROOT or ROOT in out.parents: raise SystemExit('Use a directory outside the repository')
    out.mkdir(parents=True,exist_ok=True)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    result={'renderer':'Chromium capture of shared SVG core','fps':30,'frames':360,'audio':'none','variants':{}}
    try:
        async with async_playwright() as pw:
            browser=await pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox'])
            for name,w,h in [('landscape',1280,720),('portrait',720,1280)]:
                page=await browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
                errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                await page.goto(f'http://127.0.0.1:{server.server_port}/examples/lighttable/preview.html'+('?portrait=1' if h>w else ''))
                await page.wait_for_function('window.previewReady === true')
                await page.evaluate('document.fonts.ready')
                for frame in [0,60,105,165,240,315,359]:
                    await page.evaluate('(f)=>window.renderFrame(f)',frame)
                    await page.screenshot(path=str(out/f'{name}-{frame:03}.png'))
                # Repeated seek must yield identical pixels, not merely equal source.
                await page.evaluate('window.renderFrame(240)')
                a=await page.screenshot()
                await page.evaluate('window.renderFrame(60)')
                await page.evaluate('window.renderFrame(240)')
                assert a==await page.screenshot(),f'Non-deterministic pixels: {name}'
                if not args.stills_only:
                    process=subprocess.Popen(['ffmpeg','-y','-v','error','-f','image2pipe','-vcodec','png','-r','30','-i','-','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out/f'{name}.mp4')],stdin=subprocess.PIPE)
                    try:
                        for frame in range(360):
                            await page.evaluate('(f)=>window.renderFrame(f)',frame)
                            process.stdin.write(await page.screenshot())
                        process.stdin.close()
                        if process.wait()!=0: raise RuntimeError('ffmpeg failed')
                    except BaseException:
                        process.kill();process.wait();raise
                if errors: raise RuntimeError(errors)
                result['variants'][name]={'width':w,'height':h,'browserErrors':errors,'repeatSeekPixels':'passed'}
                await page.close()
                print(name+' complete',flush=True)
            await browser.close()
    finally: server.shutdown()
    strip=Image.new('RGB',(1280,1128),'#101b25');draw=ImageDraw.Draw(strip)
    for i,frame in enumerate([60,105,165,240,315,359]):
        image=Image.open(out/f'landscape-{frame:03}.png').convert('RGB').resize((620,349))
        x=10+(i%2)*640;y=8+(i//2)*376
        strip.paste(image,(x,y));draw.text((x+4,y+351),f'{frame/30:.1f}s / frame {frame}',fill='white')
    strip.save(out/'contact-sheet.jpg',quality=92)
    (out/'capture-verification.json').write_text(json.dumps(result,indent=2)+'\n')

if __name__=='__main__': asyncio.run(main())
