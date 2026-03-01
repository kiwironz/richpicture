<!DOCTYPE html>
<html><head>
	<meta http-equiv="content-type" content="text/html; charset=UTF-8">
	<title></title>
	<meta name="generator" content="LibreOffice 24.2.7.2 (Linux)">
	<meta name="created" content="2026-03-02T09:45:40.912371399">
	<meta name="changed" content="2026-03-02T09:46:44.123021957">
	<style type="text/css">
		@page { size: 21cm 29.7cm; margin: 2cm }
		p { line-height: 115%; margin-bottom: 0.25cm; background: transparent }
		pre { background: transparent }
		pre.western { font-family: "Liberation Mono", monospace; font-size: 10pt }
		pre.cjk { font-family: "Noto Sans Mono CJK SC", monospace; font-size: 10pt }
		pre.ctl { font-family: "Liberation Mono", monospace; font-size: 10pt }
		strong { font-weight: bold }
		code.western { font-family: "Liberation Mono", monospace }
		code.cjk { font-family: "Noto Sans Mono CJK SC", monospace }
		code.ctl { font-family: "Liberation Mono", monospace }
		a:link { color: #000080; text-decoration: underline }
	</style>
</head>
<body lang="en-US" link="#000080" vlink="#800000" dir="ltr"><p style="orphans: 1">
<br>
<br>

</p>
<p style="orphans: 1"><strong>Project: Rich Picture Studio</strong></p>
<p style="orphans: 1">A browser-based diagramming application for
creating rich picture diagrams in the tradition of Soft Systems
Methodology (SSM), extended with LLM assistance. Not a strict SSM
tool — expressive, informal, accessible to non-artists.</p>
<p style="orphans: 1"><strong>Development environment</strong></p>
<ul>
	<li><p style="orphans: 1; margin-bottom: 0cm">Development VM: Ubuntu
	24.04, hostname <code class="western">sites</code>, IP <code class="western">192.168.5.83</code>
		</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">VSCode on Ubuntu 24.04
	desktop connected via Remote SSH 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">Nginx reverse proxy
	available at <code class="western">192.168.5.26</code> for eventual
	routing 
	</p></li>
	<li><p style="orphans: 1">Project root: <code class="western">~/projects/richpicture/</code>
		</p></li>
</ul>
<p style="orphans: 1"><strong>Project structure</strong></p>
<pre class="western" style="orphans: 1; background: transparent"><code class="western"><font color="#14181f"><font face="var font-mono"><span style="background: transparent">~/projects/richpicture/</span></font></font></code>
<code class="western"><font color="#14181f"><span style="background: transparent">├── </span></font></code><code class="western"><font color="#14181f"><font face="var font-mono"><span style="background: transparent">client/          # React frontend (Vite + React scaffold, running)</span></font></font></code>
<code class="western"><font color="#14181f"><span style="background: transparent">│   ├── </span></font></code><code class="western"><font color="#14181f"><font face="var font-mono"><span style="background: transparent">src/</span></font></font></code>
<code class="western"><font color="#14181f"><span style="background: transparent">│   ├── </span></font></code><code class="western"><font color="#14181f"><font face="var font-mono"><span style="background: transparent">vite.config.js</span></font></font></code>
<code class="western"><font color="#14181f"><span style="background: transparent">│   └── </span></font></code><code class="western"><font color="#14181f"><font face="var font-mono"><span style="background: transparent">package.json</span></font></font></code>
<code class="western"><font color="#14181f"><span style="background: transparent">├── </span></font></code><code class="western"><font color="#14181f"><font face="var font-mono"><span style="background: transparent">server/          # FastAPI backend stub (main.py health endpoint only)</span></font></font></code>
<code class="western"><font color="#14181f"><span style="background: transparent">├── </span></font></code><code class="western"><font color="#14181f"><font face="var font-mono"><span style="background: transparent">venv/            # Python venv (fastapi, uvicorn, python-dotenv installed)</span></font></font></code>
<code class="western"><font color="#14181f"><span style="background: transparent">└── </span></font></code><code class="western"><font color="#14181f"><font face="var font-mono"><span style="background: transparent">.env             # API keys (not committed)</span></font></font></code></pre><p style="orphans: 1">
<strong>Frontend stack</strong></p>
<ul>
	<li><p style="orphans: 1; margin-bottom: 0cm">Vite + React
	(scaffolded, dev server confirmed running at
	<a href="http://192.168.5.83:5173/">http://192.168.5.83:5173</a>) 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm"><code class="western">@xyflow/react</code>
	v12 — graph canvas layer 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm"><code class="western">roughjs</code>
	— hand-drawn sketchy rendering 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm"><code class="western">tailwindcss</code>
	v4 with <code class="western">@tailwindcss/vite</code> plugin 
	</p></li>
	<li><p style="orphans: 1">Tailwind configured via <code class="western">@import
	"tailwindcss"</code> in <code class="western">index.css</code>,
	no config file needed 
	</p></li>
</ul>
<p style="orphans: 1"><strong>Backend stack (stub, not yet active)</strong></p>
<ul>
	<li><p style="orphans: 1; margin-bottom: 0cm">FastAPI + Uvicorn 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">Python venv at project
	root 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">To activate: <code class="western">source
	~/projects/richpicture/venv/bin/activate</code> 
	</p></li>
	<li><p style="orphans: 1">To run: <code class="western">uvicorn
	server.main:app --reload</code> 
	</p></li>
</ul>
<p style="orphans: 1"><strong>Architecture overview</strong> Seven
top-level modules, built in phases:</p>
<ol>
	<li><p style="orphans: 1; margin-bottom: 0cm"><strong>Canvas Engine</strong>
	— InputHandler, GestureRecogniser (Dollar.js), Renderer (Rough.js
	over SVG), TransitionAnimator, ViewportManager 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm"><strong>Tool Palette</strong>
	— DrawingTools, ElementTools, StyleTools 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm"><strong>Visual Store</strong>
	— sole rendering source of truth, no semantics, includes
	UndoRedoStack 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm"><strong>Semantic Store</strong>
	— Conversation Log (primary LLM continuity) + Thin Index
	(confirmed interpretations only, for local rendering cues) 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm"><strong>LLM Bridge</strong>
	— ContextBuilder, RequestHandler, ResponseParser (stub Phase 1) 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm"><strong>Icon Service</strong>
	— LocalBundledIcons Phase 1, Noun Project + open image APIs Phase
	2, generative fallback Phase 4 (stub Phase 1) 
	</p></li>
	<li><p style="orphans: 1"><strong>Session Manager</strong> —
	DiagramStore (save/load/export), DiagramIndex, SyncManager (stub) 
	</p></li>
</ol>
<p style="orphans: 1"><strong>Key architectural principles</strong></p>
<ul>
	<li><p style="orphans: 1; margin-bottom: 0cm">The picture is the
	source of truth — visual canvas is primary and authoritative 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">Visual Store and
	Semantic Store are strictly separated — coupled only through LLM
	Bridge 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">The LLM is an
	interpreter not an author — all proposed changes are mediated
	through author accept/reject 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">Formal semantic
	structure is always optional — no element requires classification
	to be valid 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">Hand-drawn aesthetic
	is a design principle — Rough.js renders all shapes with sketchy
	informal style 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">Conversation log is
	the session continuity mechanism — full log restored at session
	start so LLM reconstitutes context naturally 
	</p></li>
	<li><p style="orphans: 1">Thin Index caches confirmed
	interpretations only — for local rendering decisions without API
	calls 
	</p></li>
</ul>
<p style="orphans: 1"><strong>Element vocabulary</strong></p>
<ul>
	<li><p style="orphans: 1; margin-bottom: 0cm"><strong>Nodes:</strong>
	actors (individual, role, group, organisation, external agent),
	systems (process, system, resource, information), concepts (issue,
	value, force, outcome) 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm"><strong>Relationships:</strong>
	directional (gives_rise_to, flows_to, depends_on, communicates_to,
	controls, aspires_to), bidirectional (exchange, negotiates_with,
	feedback), undirected (association, coexists_with), tension
	(conflict, competes_with, undermines) 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm"><strong>Boundaries:</strong>
	system, functional, organisational, geographic, temporal, worldview
	— containment inferred spatially, never required to be formally
	declared 
	</p></li>
	<li><p style="orphans: 1"><strong>Annotations:</strong> annotation,
	tension_marker, opportunity_marker, uncertainty_cloud 
	</p></li>
</ul>
<p style="orphans: 1"><strong>Rendering approach</strong></p>
<ul>
	<li><p style="orphans: 1; margin-bottom: 0cm">Rough.js over SVG for
	all shapes — sketchy hand-drawn aesthetic 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">Dollar.js ($N
	recogniser) for freehand gesture recognition 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">Handwriting fonts:
	Caveat, Patrick Hand, or Architects Daughter (Google Fonts) 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">On pen-up: raw stroke
	→ gesture recognised → Rough.js clean shape with 100ms animated
	transition 
	</p></li>
	<li><p style="orphans: 1">Stick figures for human actors drawn
	programmatically via Rough.js 
	</p></li>
</ul>
<p style="orphans: 1"><strong>Phase 1 scope (current) — drawing
application only</strong> LLM Bridge and Icon Service are stubs with
defined interfaces. Build order:</p>
<ol>
	<li><p style="orphans: 1; margin-bottom: 0cm">VisualStore data model
	and CRUD 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">Renderer — static
	Rough.js shapes on SVG 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">ViewportManager —
	pan and zoom 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">InputHandler +
	StrokeAccumulator 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">GestureRecogniser with
	template set 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">TransitionAnimator 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">TextTool +
	TextRenderer 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">SelectTool with
	move/resize 
	</p></li>
	<li><p style="orphans: 1; margin-bottom: 0cm">UndoRedoStack 
	</p></li>
	<li><p style="orphans: 1">SessionManager basic save/load 
	</p></li>
</ol>
<p style="orphans: 1"><strong>Immediate next step</strong> Clear Vite
scaffold boilerplate from <code class="western">src/App.jsx</code>
and <code class="western">src/index.css</code> and replace with the
skeleton canvas component structure.</p>
<hr>

<p style="line-height: 100%; margin-bottom: 0cm"><br>

</p>

</body></html>