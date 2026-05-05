import os

def fix_app():
    with open('src/App.tsx', 'r') as f:
        content = f.read()

    # 1. Fix onDrop
    old_drop = 'const track = Math.max(0, Math.min(6, Math.floor((e.clientY - rect.top - 54) / 64)));'
    new_drop = 'const track = getTrackFromY(e.clientY - rect.top);'
    content = content.replace(old_drop, new_drop)

    # 2. Fix Clip Top
    old_top = 'top: (clip.track || 0) * 64 + 54 + 4,'
    new_top = 'top: trackTops[clip.track] + 4,'
    content = content.replace(old_top, new_top)

    # 3. Add ID to viewport (if not already there)
    if 'id="timeline-viewport"' not in content:
        old_viewport = 'className="flex-1 overflow-auto relative select-none custom-scrollbar"'
        new_viewport = 'id="timeline-viewport" className="flex-1 overflow-auto relative select-none custom-scrollbar"'
        content = content.replace(old_viewport, new_viewport, 1)

    # 4. Handle Grid Background
    # This one is trickier as it might appear twice or with variations.
    # Let's target the one inside the return block.
    # Actually, I'll use a more surgical replace if possible.

    with open('src/App.tsx', 'w') as f:
        f.write(content)

fix_app()
