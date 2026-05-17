"""Regression tests for removing the mobile-only API surface."""
from __future__ import annotations

import importlib.util


MOBILE_ROUTE_PREFIXES = ("/api/mobile", "/auth/mobile")

REMOVED_MOBILE_MODULES = [
    "api.mobile_auth",
    "api.mobile_discover",
    "api.mobile_feed",
    "api.mobile_plans",
    "api.mobile_profile",
    "api.mobile_recommend",
    "api.mobile_type_actions",
    "api.mobile_uploads",
    "utils.mobile_auth",
]

MOBILE_ONLY_SCHEMA_TABLES = {
    "posts",
    "post_likes",
    "post_comments",
    "circles",
    "circle_members",
    "move_plans",
    "move_checklist_items",
    "user_badges",
    "city_stays",
    "wanderer_hops",
    "planner_boards",
    "planner_tasks",
    "free_spirit_spins",
    "local_saved_events",
    "pioneer_milestones",
}

NON_MOBILE_ROUTE_PATHS = {
    "/api/recommend",
    "/api/reveal",
    "/api/detail",
    "/api/billing/status",
    "/api/dashboard",
    "/api/dashboard/confirm",
    "/api/journey/me",
    "/api/journey/stops",
    "/api/visits/ping",
    "/auth/google",
    "/auth/google/callback",
    "/auth/me",
    "/auth/logout",
}


def test_server_does_not_expose_mobile_routes():
    from server import app

    paths = {route.path for route in app.routes}

    assert not {
        path
        for path in paths
        if path.startswith(MOBILE_ROUTE_PREFIXES)
    }


def test_server_keeps_non_mobile_routes_available():
    from server import app

    paths = {route.path for route in app.routes}

    assert NON_MOBILE_ROUTE_PATHS.issubset(paths)


def test_mobile_only_modules_are_removed():
    assert {
        module_name
        for module_name in REMOVED_MOBILE_MODULES
        if importlib.util.find_spec(module_name) is not None
    } == set()


def test_database_ready_check_no_longer_requires_mobile_only_tables():
    import utils.db as db

    assert MOBILE_ONLY_SCHEMA_TABLES.isdisjoint(db._REQUIRED_SCHEMA_TABLES)
    assert MOBILE_ONLY_SCHEMA_TABLES.isdisjoint(db._REQUIRED_SCHEMA_COLUMNS)
