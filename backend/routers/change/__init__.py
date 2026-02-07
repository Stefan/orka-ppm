"""
Change management routers: orders, approvals, analytics, full/simple management.
Import via: from routers.change.change_orders import router as change_orders_router
or: from routers.change import change_orders  (module reference).

Note: change_management and change_management_simple are not imported here to avoid
loading them on package import (change_management has optional deps). Use
from routers.change.change_management import router  when needed.
"""

from . import change_orders
from . import change_approvals
from . import change_analytics

__all__ = [
    "change_orders",
    "change_approvals",
    "change_analytics",
]
