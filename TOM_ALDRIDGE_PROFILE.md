# Tom Aldridge — personal site profile

This is the working source of truth for the personal site. It is intentionally written as editorial material rather than a CV dump: the site should present Tom as an engineer who connects low-level compute, applied AI, and real-world systems.

## Identity

- **Name:** Tom Aldridge
- **Born:** 23 April 2000
- **Based:** Leeds, England, United Kingdom
- **Current role:** Senior Engineer, Video Analytics, Blaize
- **Current focus:** High-level video analytics APIs, custom AI accelerator performance, model optimisation, OpenCL/OpenVX post-processing, high-performance vision pipelines, LLM/VLM integration, and customer-facing delivery

## Positioning

Tom works in the layer between an AI chip and the customer problem. His unusual combination is:

1. **Framework/platform engineering:** making reusable analytics capabilities possible — detection, tracking, spatial reasoning, event generation, video I/O, configuration, integrations, scheduling, and alerting.
2. **Performance engineering:** making models fast enough to ship on custom silicon — quantisation, accelerator-side post-processing, zero-copy buffers, pipelining, shared inference, and host round-trip elimination.
3. **Solutions/customer delivery:** making the technology real in deployed applications, demos, proofs of concept, trade shows, VMS integrations, and customer environments.

The key narrative is that Tom does all three. He can work from kernel and memory movement up to API design and customer outcomes.

## Current role — Blaize

### Senior Engineer — Video Analytics

**Blaize · full-time · Leeds · November 2025–present**

- Optimises models and writes OpenCL post-processing kernels for custom AI acceleration hardware.
- Benchmarks models and analyses performance characteristics.
- Builds high-performance face-recognition pipelines.
- Develops a high-level, customer-facing video analytics API.
- Integrates LLMs and VLMs with the Blaize GSP accelerator.
- Creates customer demonstrations, trade-show experiences, and hackathon prototypes.

### Software Engineer

**Blaize · full-time · October 2024–December 2025**

This role is part of the same progression into the framework, performance, and solutions work described above. Treat the current position and the progression into it as the primary Blaize story on the site; avoid presenting overlapping dates as a contradiction.

## Earlier experience — Dstl

### Data Scientist — AI and Data Systems Group

**Dstl · full-time · October 2022–October 2024 · 2 years 1 month**

- Developed real-time speech-to-text systems.
- Worked on an open-source tracking framework.
- Developed, trained, and ran inference with bespoke CNN models.
- Won hackathons and other technical events.

## Blaize technical scope

Scope note: the material below is derived from Tom's actual commit history across the Blaize `solutions` and `sdk` repositories — roughly 450 authored commits over two years, plus 182 commits authored by 25 other engineers that Tom reviewed and merged. It is written at maximum technical detail as an internal source of truth; the public site should draw from it selectively rather than reproduce it wholesale. Do not publish customer-confidential specifics beyond the customer names already listed here.

### Flagship — Network Optix (Nx Witness) VMS integration

Sole architect and implementer of a multi-process, multi-accelerator video analytics sidecar that bridges Blaize hardware into the Nx Witness video management system. This was the company's route into an existing installed VMS base, and Tom built every layer of it.

**C++ Nx server plugin.** Implemented the plugin, engine, and device-agent layers against the Nx SDK. Generated device and engine manifests dynamically from the available analytics, declared the full event-type taxonomy so a single Nx rule can match any Blaize event, and published per-analytic settings into the Nx camera settings UI so operators configure analytics where they already work. Rendered live object overlays and a separate event metadata stream, surfaced task failure states inside Nx, and added an operator-facing retry control.

**Zero-copy shared-memory transport.** Designed and hand-wrote a POSIX shared-memory frame ring to move video frames from the C++ plugin to the Python analytics daemon without copying through a socket. Wrote the ring header and C++ producer, then a Cython consumer binding on the Python side, plus a video-analytics source node that feeds frames into the analytics graph. Handled the hard parts: reclaiming orphaned segments when the daemon restarts, idempotent re-attach so a plugin reconnect does not leak a segment, and a cross-user permission model because the plugin and daemon run as different system users.

**IPC, daemon, and event return path.** Built an IPC integration adapter and a per-camera task controller, exposed as a `blaize-nx-daemon` entry point under systemd. Designed a two-socket protocol carrying batched events back to the plugin, with a converter into Nx metadata types, protobuf schema and regeneration tooling, and correct frame-PTS-based timestamping so events land on the right frame in the Nx timeline.

**Multi-accelerator orchestration.** Extended a single-accelerator design to a supervisor/worker architecture with one worker process per GSP, a per-GSP controller pool, and utilisation-based placement of new camera pipelines. Fixed a metadata crossover bug by giving each camera its own daemon client. Built a supervisor monitoring dashboard with area-tagged logging and log filtering.

**Reliability engineering.** Implemented a per-camera lifecycle finite state machine that detects and recovers failed analytics tasks. Added debounced, in-place task switching so an operator changing analytics does not tear down the pipeline; fixed mediaserver segmentation faults caused by settings callbacks firing during construction; added attach-retry cooldown and automatic recovery after sustained frame drops; and made the plugin survive a full daemon restart.

**VRAM leak investigation and upstream fix.** Ran a multi-week diagnostic campaign against an accelerator memory leak that appeared only when analytics tasks were swapped. Built temporary instrumentation to census live OpenVX graph objects, identify untracked graphs holding VRAM, and walk garbage-collector referrer chains back to the retaining anchor. Isolated the root cause in graph lifecycle management and fixed it *upstream in the Picasso SDK* across several commits — releasing the underlying `vx.Graph` in `remove_graph`, freeing duplicate index graphs, and freeing shared-runner graphs on task swap. Removed the diagnostic scaffolding and left permanent VRAM, graph, runner, and task telemetry in the daemon.

**Documentation and handoff.** Maintained a numbered design-notes document recording every divergence from the Nx SDK's assumed model and the workaround chosen, a ticket log, and session handoff notes — so the project stayed transferable rather than resident in one head.

### Whisper on Blaize silicon (TCC2)

Ported the Whisper speech-to-text transformer stack to hand-tiled GSP kernels. Wrote or adapted tiled implementations of GeMM (three variants, including a 32×64 tiling using 64 matrix registers), Softmax, RMSNorm, rotary positional encoding, SiLU, attention-mask addition, row/column copies, transposes, and the reduction primitives (max, sum-of-exponentials, RMS reciprocal) that softmax and normalisation depend on, with bf16 helper routines throughout. Built the surrounding architecture: separate prefill and non-prefill transformer blocks, a Whisper LLM driver, buffer helpers over the Blaize buffer types, ZMQ transport, and a Python C++ extension module so the whole thing is callable from the analytics stack. Integrated a colleague's Llama 3 port into the same launcher.

Alongside the model work, built the **TCC deployment launcher**: a themed operator UI with bundled typography, singleton enforcement, crash resilience, in-app documentation, an offline install path with staged model weights, and a power-monitor surface. Ported the hardware **certification suite** to a new SDK version, including a device-check module and a certification runner.

### Platform ownership — visualisation subsystem

Designed, and then twice rewrote, the analytics rendering layer now used across the product.

The final architecture is three layers. A renderer base class defines drawing primitives and emits render commands, with concrete OpenCV and Pyglet backends behind it. A style class hierarchy turns analytics primitives — bounding boxes, lines, paths, skeletons, regions — into render command lists, with a minimal base style and derived Blaize, corner-bracket, high-contrast, and legacy styles overriding specific primitives. A theme loader reads YAML and constructs style subclasses dynamically at runtime, so a customer look is a config file rather than a code change.

On top of that: a labelling engine with verbosity tiers and per-type label text, an arrow primitive, per-class bounding-box colouring, skeleton rendering for pose models, threaded rendering with frame-skip for throughput, and an integration hook letting an integration adapter supply visualiser arguments. Also built an experimental decentralised rendering path — analytics produce visualisation metadata at the edge, a media compositor on the host draws it — to remove rendering cost from the accelerator entirely.

### Recognition and re-identification pipeline

Built the face and feature management stack end to end. Started with a face manager object, added a file-backed variant, then generalised the whole thing into a `FeatureManager` handling arbitrary embedding types — with caching on feature retrieval, optional recognition metrics, feature-file datatype validation, and identity-lookup correctness fixes. Decoupled the recognition model from the feature store so either can change independently, added a memory cache to the recognition analytic, and used Laplacian variance as a blur gate so low-quality crops never reach the embedder.

Built the object re-identification analytic, its models, and the person re-identification examples, including reidentified-image attachment to reported events.

Integrated and made runnable a wide set of face models: RetinaFace, YUNet keypoint detection, AdaFace processing with the new recognition metrics, IResnet50 embedders, and a partner (SeventhSense) detector and recognizer pair requiring custom OpenVX graph and kernel source. Refactored the recognition components twice as the requirements clarified.

### On-chip acceleration and model performance

- Moved segmentation non-maximum suppression onto the GSP, removing a host round-trip from the segmentation path.
- Authored a colour-detection OpenCL kernel and the node that drives it.
- Wrote and maintained post-processing modules for the segmentor, re-identification, embedding, ROI, keypoint, and recognition model families, plus RetinaFace and YUNet specifically.
- Added a force-bf16 model output option for models where the default precision cost accuracy or performance.
- Made segmentation and pose models runnable from YAML config, and fixed segmentation visualisation scaling and performance — including skipping segmentation post-processing entirely when no visualiser is attached.
- Renamed and reorganised the post-NMS processing family as the model set grew.

### Benchmarking, quality, and developer infrastructure

**Unified benchmarking suite**, built from scratch: mean-average-precision tests, a bounding-box accuracy template task, detector bbox-and-class benchmarks, per-model and all-model configuration files, a dedicated benchmarking integration adapter, its own test suite and README, and a CPU-governor check so benchmark numbers are not silently invalidated by a throttled host.

**Model infrastructure.** Migrated the entire model tree out of the Python package into a shared repository root and rewrote every reference to it; added environment-variable-driven model discovery; removed the deprecated path-resolution code; packaged reference models as a CI build artifact on tag push; and owned model and dataset licence metadata across the catalogue, including a LICENSE addendum for release.

**CI and release engineering.** Owned six releases end to end — version bumps, release notes, repository-wide copyright sweeps, and a script to automate the version update. Migrated CI machines to newer versions and modified the pipelines accordingly. Consolidated the wheel build (folding a hydrated/dehydrated split into one default), preserved the uv install path in CI so cache pruning worked, added a debug-statement detection script and CI job to stop stray prints reaching a release, and maintained the example-validation pipeline.

**Developer experience.** Built `blaize-run`, a launcher that replaced hand-written `main.py` boilerplate in every example application repository-wide. Added a JSON Schema for the Studio parameter definitions plus validation against it, direct indexing into the parameter manager, and a live parameter-update callback so config changes apply without a restart. Wrote the Sphinx documentation strategy and theming, an FAQ, integration adapter documentation, and per-analytic event descriptions. Authored the repository's engineering-convention document and the subsystem reference documentation the team's AI tooling reads first.

### Framework and analytics components

- Analytics classes: toggleable analytics, detect-detect chaining, path manager memory (later homogenised into one path manager class), path-tracked-object smoothing and visualisation, occupancy event analysis fixes, an early heatmap implementation, and an experimental topology-based navigation hierarchy.
- Type system: owned the concrete and protocol type modules. Refactored the Bezier path into a concrete type with improved curve fitting and arbitrary-degree distance calculation, made rectangle geometry return a consistent clockwise four-point list, conformed the rectangle constructor to the point protocol, added a generic keypoint object type, converted the event class to a Pydantic model, and added point serialisation to event payloads.
- Video I/O: pipe-based and JPEG pipe decoders, a standard file-URI parser, live-source forcing, drop-frame semantics, and video upload with queued transcoding.
- Configuration: video stream parameter definitions and validation regex, optional-TLD URL parameters, and the schema work described above.

### Integrations

Wrote the adapters connecting Blaize analytics to external systems: Amazon, SCIAB (with deployment-ID tagging, response handling, and logging), AI Studio (homogenised with SCIAB so both share one code path), Vantiq, a VS Code integration, the Nx/VMS IPC adapter, a WebSocket visualiser with source-side frame throttling, the GitEx dashboard adapter, and TCC-specific adapters. Also REST and MQTT backends.

### Customer delivery

Shipped analytics applications and demonstrations for **GitEx 2026, World AI Show, ISC West, Amazon, SeventhSense, Milestone/Hafnia, Scenara, Safespace, and TCC**. Application domains included fire and smoke detection, harbour and region protection, airborne object detection, missing-person detection, crowd estimation, ANPR (including a Philippines/SAE deployment and temporal licence-plate recognition), PPE and industrial hazard detection, fall detection with pose estimation, jaywalking, runway incursion, bike-path monitoring, vehicle type classification and counting, smoking and improper-mask detection, and multi-analytic traffic and people-and-crowds applications.

Built the **modular multi-vertical dashboard** that became the standard demonstration surface, promoted from a customer folder to the repository root once it generalised: one template serving every vertical, configuration-driven tab sets and profiles, a bespoke "command center" design system with a light mode, event cards and a live ticker, a stream relay with slot assignment across grids, locally hosted maps, and Docker Compose deployment with launch scripting.

**On-site customer work.** Spent time in Riyadh working directly with a customer on-site in a high-stress, high-impact deployment scenario — debugging, tuning, and delivering against a live deadline in the customer's own environment.

**Public-facing work.** Recorded promotional video for trade shows, produced customer demonstration material, and appeared in public YouTube recordings representing the technology.

### Technical leadership

- **Merge gatekeeper.** Reviewed and merged 182 commits authored by 25 other engineers. The review was substantive rather than procedural: commit history shows Tom enforcing module boundaries, correcting API shape, and holding house style at the merge point — for example separating IOU helpers into their own module, correcting bounding-box representation assumptions in new analytics code, and reworking contributions to match repository conventions before they landed.
- **Cross-repository ownership.** Repeatedly diagnosed a problem in the application layer and fixed the root cause in the SDK rather than working around it: accelerator graph memory lifecycle, decoder loop semantics and drop-frame timer reset, RTSP NTP synchronisation in the GStreamer decoder, and OpenVX area-interpolation type support.
- **Enablement.** Handed off working subsystems to named colleagues with the examples and files they needed, and wrote the conventions and reference documentation that onboard both people and tooling.

### Self-hosted LLM and GPU infrastructure

Stood up and operates local large-language-model serving infrastructure: vLLM and Ollama on bare metal across multiple GPUs, and on NVIDIA DGX hardware, self-hosting models including Qwen3.8 and GLM-5.3-Flash. This covers multi-GPU model sharding and placement, serving-engine configuration and tuning, and the practical trade-offs between model size, quantisation, throughput, and latency on fixed hardware — the same performance-engineering instinct as the accelerator work, applied to a different class of silicon.

## Highlight — Project Hafnia hackathon

After a workshop with Milestone Systems in Denmark around Project Hafnia and vision-language models in smart-city applications, Tom's team placed **second** in the hackathon and won €3,000 for **Optimised VLM Usage**.

The work optimised token consumption and network usage by constraining video resolution and frame rate to the underlying VLM architecture. The VLM was then used to contextualise, triage, and plan responses to emergency events in real time, with the Blaize GSP accelerator supporting the system. Tom built the supporting dashboard, task-level prompting, and the routing between analytics and the VLM.

Editorial angle: this is a concise example of Tom's wider approach — respecting the actual constraints of a system, then using intelligence where it creates the most value.

## Education

### MSc Computational Neuroscience, Cognition and Artificial Intelligence

**University of Nottingham**

- Graduated with **Distinction**.
- Research project achieved a joint-highest mark across the School of Psychology: **85%**.
- Received the Postgraduate Award for the highest overall grade across the course: **77%**.
- No module mark below 70%.

### BSc Financial Mathematics

**University of Nottingham**

- Graduated with **First Class (Hons)**.

## Research project

### Investigating the impact of traumatic brain injuries on brain connectivity changes for Alzheimer’s disease using probabilistic tractography

**MSc Computational Neuroscience, Cognition and AI Research Project · University of Nottingham · 16 September 2022**

The project studied white-matter integrity in Vietnam War veterans using diffusion-weighted imaging from the ADNI-DOD database. It used probabilistic tractography to estimate pathways between defined brain regions, calculated tract-specific anisotropy (TSA), and regressed the resulting measures against injury-related factors.

### Method and technical vocabulary

- Python 3.10.4 and pandas for metadata exploration.
- DICOM-to-NIfTI conversion with dcm2niix.
- GPU processing on the University of Nottingham Augusta HPC service.
- FMRIB Diffusion Toolbox processing, including preprocessing, BedpostX, and ProbtrackX/probabilistic tractography.
- LCNET regions of interest spanning the anterior cingulate cortex, posterior cingulate gyrus, and locus coeruleus.
- Linear regression / GLM-style analysis of TSA values against injury factors.
- T-statistics, p-values, and false discovery rate correction using `statsmodels`.
- Visual analysis with tract renders, heatmaps, circular t-statistic plots, scatter plots, and violin plots.

### Findings

- 52 of 55 attempted bidirectional tracts were successfully determined across 11 brain regions.
- TBI severity showed the strongest relationship with reduced diffusion profiles: 43 of 52 tracts showed negative effects.
- Altered mental state / “brain fog” also showed widespread negative effects: 37 of 52 tracts.
- Connectivity involving the locus coeruleus was often among the most deteriorated.
- The results support the hypothesis that TBI can degrade white-matter pathways involved in memory, cognition, attention, and motor control, while the report clearly acknowledges cohort, survey, and methodological limitations.

### Research identity

The thesis is useful evidence of Tom’s ability to handle ambiguous scientific questions, large data pipelines, HPC/GPU compute, statistical inference, visualisation, and careful interpretation. It also gives the personal site a human-scale counterpoint to the current silicon-and-video work: from neural pathways to neural accelerators.

## Personal engineering and interests

### Software and reverse engineering

- Builds software in spare time.
- Building a Football Manager mod manager.
- Reverse engineering Football Manager save-game and data structures.
- Building `chronicleandledger.com`, a bespoke customer-progress platform for vehicle restoration.

### LLMs and local AI

- Runs local LLM and VLM infrastructure at both hobby and professional scale — see "Self-hosted LLM and GPU infrastructure" above for the work-side detail.
- Works with GGUF quantisation, vLLM and Ollama serving, multi-GPU bare-metal hosting, and NVIDIA DGX hardware.
- Self-hosts open-weight models including Qwen3.8 and GLM-5.3-Flash.
- Interested in the practical boundary between model capability, hardware constraints, serving architecture, and useful applications.

### Hardware, systems, and home technology

- Builds gaming PCs.
- Sets up servers and PCs.
- Runs CI and development infrastructure.
- Handles local networking, home automation, and home security systems.

Editorial angle: Tom’s curiosity continues beyond his job. He likes understanding systems end to end, taking them apart, and rebuilding them into something useful.

## Technology index

**Languages.** Python, C++17, Cython, OpenCL / CLC, JavaScript, Vue, HTML/CSS, Bash, YAML / JSON / TOML, reStructuredText and Markdown, some assembly.

**Blaize and accelerator stack.** Picasso SDK, the `act` asynchronous graph framework, `Node` and `GSPNode` execution, OpenVX and `vx.Graph` lifecycle, GSP kernel authoring, the `.bm` model format, bf16 / amp / int8 quantisation, Blaize AI Studio.

**Computer vision and ML.** YOLO family (v5, v7, v8, X, SEGv8), PoseNet, RetinaFace, YUNet, AdaFace, IResnet50, DeepSORT tracking, re-identification, semantic segmentation, non-maximum suppression, mean-average-precision evaluation, crowd estimation, ANPR and OCR, keypoint and pose estimation, Whisper speech-to-text, transformer inference, vision-language models.

**Systems and infrastructure.** POSIX shared memory and ring buffers, ZeroMQ, protobuf, Unix domain sockets, systemd, multi-process supervisors, GPU and accelerator memory lifecycle management, RTSP, GStreamer, OpenCV codecs, NTP synchronisation, Docker and Docker Compose, multi-GPU serving with vLLM and Ollama, NVIDIA DGX.

**Practice and tooling.** GitLab CI (including runner migration and pipeline modification), pytest with parametrisation, fixtures, forked execution and hardware mocking, HuggingFace Hub, Sphinx, uv and pip packaging, JSON Schema, Pydantic, semantic release management, open-source licence compliance.

**Domains.** Edge AI deployment, video analytics, video management system integration, security and surveillance, public safety, defence, industrial safety and PPE, intelligent transport systems, retail, hardware certification.

## Timeline

| Period | Chapter | Signal |
| --- | --- | --- |
| 2022 | MSc research project | Neuroimaging, probabilistic tractography, HPC, statistics |
| 2022–2024 | Dstl Data Scientist | Speech-to-text, CNNs, tracking, applied AI, hackathons |
| 2024–2025 | Blaize Software Engineer | Edge AI framework and customer delivery |
| 2025–present | Blaize Senior Engineer | Custom silicon, kernels, VMS integration, vision pipelines, VLMs, high-level APIs |
| Always | Independent builder | Reverse engineering, local AI, servers, platforms, hardware |

## Recommended voice

Confident, precise, curious, and technically grounded. Write for a strong engineer or technical leader, but keep the language human. Prefer specific verbs and concrete constraints over vague claims. The site should feel like an invitation into a working system, not a list of technologies.

Useful phrases:

- “The layer between the chip and the problem.”
- “Making intelligence move at the speed of the system around it.”
- “From kernels to customer outcomes.”
- “I build the software that turns specialised compute into useful products.”
- “I like the part where the theory meets the bottleneck.”

Avoid:

- Calling Tom a generic “AI enthusiast”.
- Over-indexing on corporate job titles.
- Claiming unverified metrics or customer names beyond what is listed here.
- Publishing confidential Blaize implementation details, customer data, private infrastructure details, or proprietary code.

## Source notes

- Current role, employment timeline, skills, interests, and LinkedIn-style announcements were supplied directly by Tom on 7 August 2026.
- `Research_Project.pdf` was extracted and reviewed locally; the research summary above is based on the report’s abstract, methods, results, and discussion.
- `CV2024.2.pdf` is present locally and appears image-based; text extraction did not yield readable content. The supplied current role history and project description take precedence over the older PDF where they overlap.
- The "Blaize technical scope" section was rebuilt on 3 September 2026 from a full audit of Tom's commit history across the Blaize `solutions` and `sdk` repositories, covering all branches — approximately 450 authored commits between October 2024 and September 2026, plus 182 commits authored by others that Tom reviewed and merged. Claims in that section trace to specific commits.
- Self-hosted LLM infrastructure, CI machine migration, Riyadh on-site customer work, promotional and YouTube recordings, and the Hafnia placement detail were supplied directly by Tom on 3 September 2026.
- The Llama 3 port to Blaize silicon was authored by a colleague; Tom integrated it into the TCC deployment launcher. Do not attribute the port itself to Tom.
