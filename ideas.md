# Ideas

## Ink Mode
Transform the digital canvas into a hand-drawn, paper-like aesthetic with sketchy edges, cream paper texture, handwriting fonts, and organic imperfections. Makes graphs feel like artifacts worth sharing rather than sterile computer output. Users select theme preference (stored in DB), theme definitions stay hardcoded in code.

## Erosion Mode
The graph slowly fades and decays over time like a real whiteboard that hasn't been touched - nodes lose opacity, edges thin out, colors desaturate. Any element you talk about, reference, or interact with regenerates to full vibrancy. Creates a living archaeological record where the graph itself shows you what matters through use, not through manual organization. Your attention becomes the preservation mechanism, mimicking how real memory and artifacts work - the things we touch and revisit stay vivid, everything else becomes patina.

## Rhythm Mode
The graph's spatial density and layout mirrors your actual conversation cadence with the AI. Rapid-fire exchanges create tight energetic clusters, long thoughtful pauses spread nodes apart with breathing room, heavy revision tangles areas with overlapping edges, clean confident building flows linearly. Brainstorming sessions look explosive and chaotic, careful planning looks methodical and grid-like, confused exploration looks tangled with backtracking paths. The graph becomes a visual echo of HOW you think, not just what you think - your cognitive rhythm frozen in space.

## Ghost Autocomplete Mode
As you hover over any node, the AI predicts likely next nodes based on your graph's pattern and renders them as translucent ghost suggestions. Hover on "Authentication" and see faint outlines for "Session Management," "Password Reset," "OAuth." Hover on "Maria" in a family tree and see ghost children or siblings. Press Tab to materialize the ghost into a real node, Shift+Tab to cycle through alternatives. The AI learns from your graph's structure in real-time - the more you build, the smarter the predictions. Like IDE autocomplete but for thinking - the canvas whispers what might come next. Also some nodes untouched nodes can collapse after a while or after a certain amount of nodes. 

## Notes Mode
You talk to the AI and it scribes to the right side, then you can ask the other AI to pass it into structure

## God Mode
You only talk. It uses a websocket and sends signals to the LLM with a rolling window and sends commands to the backend.

## Add "Controls"
Expose a lot of controls to the AI, the user just asks for changes like "make the graph more compact" or "make the boxes be larger".

## Add "Focus Mode"
When clicking on a specific node, other neighboring nodes get simplified, only showing the relationship with said node / When collapsing we render metadata.
