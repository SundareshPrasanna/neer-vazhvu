"""
Dynamic World water-fraction trend (2022 - present) per zone of a rich-data body.

Entry point kept because the <body_id>-dw-water-trend.json artifacts name it as
their producer; the logic is verify_rich_body_built_trend.py --class water.
"""

import sys

from verify_rich_body_built_trend import cli

cli(["--class", "water", *sys.argv[1:]])
