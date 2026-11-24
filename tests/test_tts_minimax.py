import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'template' / 'scripts'))
import tts_build  # noqa: E402


def test_build_minimax_blocks_grouping_and_punctuation():
    items = [
        {'type': 'chapter', 'chapter': 1, 'title': 'Ch1'},
        {'type': 'sent', 'chapter': 1, 'raw': '第一句没有句号|切块继续', 'gap_before': 0},
        {'type': 'sent', 'chapter': 1, 'raw': '第二句有感叹号！', 'gap_before': 0},
        {'type': 'sent', 'chapter': 1, 'raw': '第三句前面有停顿', 'gap_before': 12},
        {'type': 'chapter', 'chapter': 2, 'title': 'Ch2'},
        {'type': 'sent', 'chapter': 2, 'raw': '新章节第一句', 'gap_before': 0},
    ]
    blocks = tts_build.build_minimax_blocks(items, 'zh', sep='')
    assert len(blocks) == 3
    assert blocks[0]['text'] == '第一句没有句号切块继续。第二句有感叹号！'
    assert blocks[1]['text'] == '第三句前面有停顿。'
    assert blocks[2]['text'] == '新章节第一句。'

    for blk in blocks:
        for meta in blk['sents']:
            assert blk['text'][meta['char_start']:meta['char_end']] == meta['tts_text']


def test_extract_minimax_block_words_offsets_and_relative_segment_time():
    block_text = '检索测试。第二句！'
    segments = [
        {
            'text_begin': 0,
            'time_begin': 0.0,
            'timestamped_words': [
                {'word': '检', 'word_begin': 0, 'word_end': 1, 'time_begin': 200.0, 'time_end': 350.0},
                {'word': '测', 'word_begin': 2, 'word_end': 3, 'time_begin': 500.0, 'time_end': 650.0},
                {'word': '。', 'word_begin': 4, 'word_end': 5, 'time_begin': 650.0, 'time_end': 900.0},
            ],
        },
        {
            'text_begin': 5,
            'time_begin': 1000.0,
            'timestamped_words': [
                # Relative word_begin (0..1) + relative time_begin (50ms < 1000 - 50)
                {'word': '第', 'word_begin': 0, 'word_end': 1, 'time_begin': 50.0, 'time_end': 200.0},
                # Global word_begin (7..8) fallback + out-of-order slight jitter clamped monotonic
                {'word': '句', 'word_begin': 7, 'word_end': 8, 'time_begin': 40.0, 'time_end': 300.0},
                {'word': ' ', 'word_begin': 4, 'word_end': 5, 'time_begin': 0.0, 'time_end': 10.0},
                {'word': '！', 'word_begin': 8, 'word_end': 9, 'time_begin': 300.0, 'time_end': 400.0},
            ],
        },
    ]
    words = tts_build.extract_minimax_block_words(block_text, segments)
    assert [w['text'] for w in words] == ['检', '测', '第', '句']
    assert words[0]['g0'] == 0 and abs(words[0]['t'] - 0.2) < 1e-6
    assert words[2]['g0'] == 5 and abs(words[2]['t'] - 1.05) < 1e-6
    # Forced monotonic after sorting by g0
    assert words[3]['g0'] == 7 and words[3]['t'] >= words[2]['t']


def test_split_minimax_block_measured_and_fallback():
    sr = tts_build.SR
    n = int(3.0 * sr)
    t = np.arange(n, dtype=np.float32) / sr
    block_x = np.zeros(n, dtype=np.float32)
    # Two bursts separated by silence
    ia1, ib1 = int(0.1 * sr), int(1.0 * sr)
    ia2, ib2 = int(1.6 * sr), int(2.7 * sr)
    block_x[ia1:ib1] = 0.4 * np.sin(2 * np.pi * 220.0 * t[ia1:ib1])
    block_x[ia2:ib2] = 0.4 * np.sin(2 * np.pi * 330.0 * t[ia2:ib2])

    block_text = '第一块|第二块。下一句。'
    # Clean block text (without |) as built by build_minimax_blocks
    clean_block = '第一块第二块。下一句。'
    sent_metas = [
        {'item_idx': 0, 'chunks': ['第一块', '第二块'], 'tts_text': '第一块第二块', 'char_start': 0, 'char_end': 6},
        {'item_idx': 1, 'chunks': ['下一句'], 'tts_text': '下一句', 'char_start': 7, 'char_end': 10},
    ]
    segments = [
        {
            'text_begin': 0,
            'time_begin': 0.0,
            'timestamped_words': [
                {'word': '第', 'word_begin': 0, 'word_end': 1, 'time_begin': 120.0, 'time_end': 300.0},
                {'word': '二', 'word_begin': 3, 'word_end': 4, 'time_begin': 600.0, 'time_end': 980.0},
                {'word': '下', 'word_begin': 7, 'word_end': 8, 'time_begin': 1620.0, 'time_end': 2000.0},
                {'word': '句', 'word_begin': 9, 'word_end': 10, 'time_begin': 2200.0, 'time_end': 2650.0},
            ],
        }
    ]
    res = tts_build.split_minimax_block(block_x, clean_block, sent_metas, segments, sep='', sr=sr)
    assert len(res) == 2
    for x, starts, char_secs, dur, measured in res:
        assert measured is True
        assert dur > 0
        assert starts == sorted(starts)
        assert all(0.0 <= s < dur for s in starts)
        assert len(char_secs) == len(starts)

    # Missing words on second sentence -> falls back gracefully to pause alignment (estimated)
    bad_segs = [{'text_begin': 0, 'time_begin': 0.0, 'timestamped_words': segments[0]['timestamped_words'][:2]}]
    fb = tts_build.split_minimax_block(block_x, clean_block, sent_metas, bad_segs, sep='', sr=sr)
    assert len(fb) == 2
    assert all(r[4] is False for r in fb)
    assert all(r[3] > 0 and r[1] == sorted(r[1]) for r in fb)


def test_chunk_starts_edge_style():
    chunks = ['hello', 'world']
    tts_text = 'hello world'
    words = [
        {'t': 0.2, 'd': 0.3, 'text': 'hello'},
        {'t': 0.6, 'd': 0.4, 'text': 'world'},
    ]
    starts, char_secs = tts_build.chunk_starts(tts_text, chunks, words, lead_cut=0.1, dur=1.2, sep=' ')
    assert len(starts) == 2
    assert starts[0] == 0.0
    assert abs(starts[1] - 0.5) < 1e-6
    assert [len(fc) for fc in char_secs] == [5, 5]
