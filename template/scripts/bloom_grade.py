#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""渲后辉光 grade（opt-in）：ffmpeg 伪 bloom + halation，LDR 仿真口径。

定位（v4.4.0，方法论吸收 mexicat/pdoom-video docs/ENGINE.md 后期链的 LDR 仿真版）：
pdoom 的 bloom/halation 跑在线性 HDR 域，Remotion/DOM 架构拿不到"已合成帧"，
做不了渲染内真辉光；本脚本在渲染之后、finalize 之前对成片做一次性 grade：
亮部降采样高斯模糊 -> 暖色 halation -> screen 叠回。LDR 仿真而非 HDR 辉光——
强对比画面效果最好，低对比画面接近无感（先渲一帧对比再决定要不要上）。

流程位置与证据链纪律：
  - 在三轮验收之前定稿（grade 改变像素 = 旧 QC 证据失效）；跑完本脚本后
    probe/finalize 照常全跑，交付链路不变。
  - opt-in：默认不跑。deep 底/高对比卡（neon/vhs-outrun/pop-dot/crt-terminal 类）
    优先试；浅底纸面卡（paper/swiss 类）慎用（screen 叠加会抬黑）。

用法（项目根跑）：
  uv run python scripts/bloom_grade.py <成片.mp4> [-o <输出.mp4>] [--preset medium]
      [--no-halation] [--audio copy]
  默认输出 <成片名>.bloom.mp4；档位判准见下方「档位制」节。
自测：uv run python scripts/bloom_grade.py --selftest

安全口径：filter 图全部为模块级常量（无字符串构造进命令）；subprocess
调用点内联完整参数列表 + shell=False。
"""
import argparse
import subprocess
import sys
from pathlib import Path

# 六张固定 filter 图（档位 x halation 开关）。全部模块级常量，无格式化、无拼接。
GRAPH_LOW = (
    '[0:v]split=2[base][bl];'
    '[bl]gblur=sigma=4:steps=2,eq=contrast=1.25[bls];'
    '[base][bls]blend=all_mode=screen:all_opacity=0.25[vout]'
)
GRAPH_MEDIUM = (
    '[0:v]split=2[base][bl];'
    '[bl]gblur=sigma=6:steps=2,eq=contrast=1.25[bls];'
    '[bls]colorbalance=rm=0.35:gm=0.12:bm=-0.15:rs=0.35:gs=0.12:bs=-0.15[hal];'
    '[base][hal]blend=all_mode=screen:all_opacity=0.25[s1];'
    '[s1][bls]blend=all_mode=screen:all_opacity=0.35[vout]'
)
GRAPH_MEDIUM_NOHAL = (
    '[0:v]split=2[base][bl];'
    '[bl]gblur=sigma=6:steps=2,eq=contrast=1.25[bls];'
    '[base][bls]blend=all_mode=screen:all_opacity=0.35[vout]'
)
GRAPH_HIGH = (
    '[0:v]split=2[base][bl];'
    '[bl]gblur=sigma=9:steps=2,eq=contrast=1.25[bls];'
    '[bls]colorbalance=rm=0.35:gm=0.12:bm=-0.15:rs=0.35:gs=0.12:bs=-0.15[hal];'
    '[base][hal]blend=all_mode=screen:all_opacity=0.35[s1];'
    '[s1][bls]blend=all_mode=screen:all_opacity=0.50[vout]'
)
GRAPH_HIGH_NOHAL = (
    '[0:v]split=2[base][bl];'
    '[bl]gblur=sigma=9:steps=2,eq=contrast=1.25[bls];'
    '[base][bls]blend=all_mode=screen:all_opacity=0.50[vout]'
)
PRESETS = {
    ('low', True): GRAPH_LOW, ('low', False): GRAPH_LOW,
    ('medium', True): GRAPH_MEDIUM, ('medium', False): GRAPH_MEDIUM_NOHAL,
    ('high', True): GRAPH_HIGH, ('high', False): GRAPH_HIGH_NOHAL,
}
PRESET_DESC = {
    'low': 'bloom 0.25/sigma 4（low 档即无暖染）',
    'medium': 'bloom 0.35/sigma 6 + hal 0.25',
    'high': 'bloom 0.50/sigma 9 + hal 0.35',
}


def grade(src: Path, dst: Path, preset='medium', halation=True, audio='copy') -> None:
    """按档位取固定 filter 图执行；调用点内联完整参数列表 + shell=False。"""
    graph = PRESETS[(preset, bool(halation))]
    if audio == 'copy':
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(src),
                        '-filter_complex', graph, '-map', '[vout]', '-map', '0:a?',
                        '-c:a', 'copy', '-c:v', 'libx264', '-preset', 'slow',
                        '-crf', '16', '-pix_fmt', 'yuv420p', str(dst)],
                       check=True, shell=False)
    else:
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(src),
                        '-filter_complex', graph, '-map', '[vout]', '-an',
                        '-c:v', 'libx264', '-preset', 'slow',
                        '-crf', '16', '-pix_fmt', 'yuv420p', str(dst)],
                       check=True, shell=False)
    desc = PRESET_DESC[preset] + ('' if halation else '（no-halation）')
    print('bloom_grade: ' + preset + '（' + desc + '） -> ' + str(dst))


def selftest() -> int:
    """合成高对比帧（黑底+白块）→ grade(high) → 验白块外亮度抬升（辉光溢出生效）、远角近黑。"""
    import tempfile
    tmp = Path(tempfile.mkdtemp(prefix='bloom-grade-'))
    src = tmp / 'in.mp4'
    dst = tmp / 'out.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi',
                    '-i', 'color=c=black:s=320x180:d=1:r=30',
                    '-vf', 'drawbox=x=120:y=60:w=80:h=60:color=white:t=fill',
                    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
                    str(src)], check=True, shell=False)
    grade(src, dst, preset='high', halation=True, audio='none')

    def sample(x, y):
        # 2x2 采样（本机 ffmpeg 8.1.1 的 1x1 crop 有解析怪癖，2x2 起正常）
        r = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(dst),
                            '-vf', 'crop=2:2:' + str(x) + ':' + str(y),
                            '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
                           capture_output=True, shell=False)
        buf = r.stdout
        return (sum(buf) // max(1, len(buf))) if buf else 0
    glow = sample(215, 90)
    corner = sample(10, 10)
    passed = glow >= 12 and corner <= 30
    print('selftest: glow(白块外)=' + str(int(glow)) + ' corner(远角)=' + str(int(corner))
          + ' -> ' + ('PASS' if passed else 'FAIL'))
    return 0 if passed else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video', nargs='?', help='成片路径（渲后、finalize 前）')
    ap.add_argument('-o', '--out', default=None, help='输出路径（默认 <成片名>.bloom.mp4）')
    ap.add_argument('--preset', default='medium', choices=['low', 'medium', 'high'],
                    help='grade 档位（默认 medium，判准见文件头）')
    ap.add_argument('--no-halation', action='store_true', help='关暖染只留中性 bloom')
    ap.add_argument('--audio', default='copy', choices=['copy', 'none'], help='音轨处理（默认 copy）')
    ap.add_argument('--selftest', action='store_true', help='合成片自测')
    a = ap.parse_args()
    if a.selftest:
        sys.exit(selftest())
    if not a.video:
        ap.error('需要 video 路径（或 --selftest）')
    src = Path(a.video)
    dst = Path(a.out) if a.out else src.with_name(src.stem + '.bloom.mp4')
    grade(src, dst, a.preset, not a.no_halation, a.audio)


if __name__ == '__main__':
    main()
