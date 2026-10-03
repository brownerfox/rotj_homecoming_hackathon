import pytest


def preflight(client, origin: str):
    return client.options(
        "/jobs",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"},
    )


@pytest.mark.parametrize("origin", [
    "http://localhost:8080",
    "http://localhost:5173",
    "http://127.0.0.1:8080",  # the same page opened by IP instead of name
    "http://10.37.117.40:8080",  # Vite's "Network" address
    "http://192.168.1.20:5173",
])
def test_the_frontend_is_allowed_from_any_local_address(client, origin):
    response = preflight(client, origin)
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


@pytest.mark.parametrize("origin", ["https://evil.example", "http://8.8.8.8:8080", "http://localhost.evil.example"])
def test_other_sites_are_refused(client, origin):
    assert preflight(client, origin).status_code == 400
