import sys
import tempfile
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'template' / 'scripts'))
import narration_lib as nl  # noqa: E402


def _parse_text(text):
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / 'narration.txt'
        p.write_text(text, encoding='utf-8')
        return nl.parse(p)


def test_parse_anchors_zh_and_swell():
    items = _parse_text(
        '# CHAPTER 1 开场\n'
        '## swell\n'
        '检索会先找到{#hit}最相关的|{#part2}三段。\n'
    )
    assert items[0] == {'type': 'chapter', 'chapter': 1, 'title': '开场'}
    sent = items[1]
    assert sent['gap_before'] == 42
    assert sent['raw'] == '检索会先找到最相关的|三段。'
    assert nl.sentence_anchor_indices(sent, sep='') == [('hit', 6), ('part2', 10)]
    tts_text = ''.join(sent['raw'].split('|'))
    assert tts_text[6] == '最'
    assert tts_text[10] == '三'


def test_parse_anchors_en_with_pipe_separator():
    items = _parse_text('First part | {#hit}second {#tail}part.\n')
    sent = items[0]
    assert sent['raw'] == 'First part|second part.'
    assert nl.sentence_anchor_indices(sent, sep=' ') == [('hit', 11), ('tail', 18)]
    tts_text = ' '.join(sent['raw'].split('|'))
    assert tts_text[11] == 's'
    assert tts_text[18] == 'p'


def test_parse_anchors_trailing_before_pipe_attaches_to_next_chunk():
    items = _parse_text('First part{#hit} | second part.\n')
    sent = items[0]
    assert nl.sentence_anchor_indices(sent, sep=' ') == [('hit', 11)]


def test_parse_anchors_errors():
    for bad in [
        '重复{#dup}锚点在{#dup}这里\n',
        '跨句{#dup}第一\n第二句{#dup}重复\n',
        '锚点在句尾{#end}\n',
        '锚点在末尾带空格{#end}   \n',
        '{#BadCase}大写非法\n',
        '{#1bad}数字开头非法\n',
        '{#}空id\n',
        '未闭合{#abc\n',
    ]:
        with pytest.raises(SystemExit):
            _parse_text(bad)
