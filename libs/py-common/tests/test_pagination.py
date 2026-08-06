from py_common.pagination import MAX_LIMIT, PageParams, page_envelope


def test_parse_defaults():
    p = PageParams.parse()
    assert p.limit == 50 and p.offset == 0


def test_parse_clamps():
    p = PageParams.parse(limit=100000, offset=-5)
    assert p.limit == MAX_LIMIT
    assert p.offset == 0


def test_envelope_shape():
    env = page_envelope([1, 2, 3], total=123, params=PageParams.parse(limit=50, offset=0))
    assert env == {"items": [1, 2, 3], "total": 123, "limit": 50, "offset": 0}
