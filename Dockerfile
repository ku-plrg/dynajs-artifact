# DynaJS artifact — single image that runs the local install from README.md for
# ALL four components: DynaJS, Extractor (esmeta), NodeMedic, and ExpoSE.
# The per-tool Dockerfiles under ./nodemedic and ./expose are intentionally
# ignored; this file follows the "How to install" steps in README.md instead.
#
#   Build:  docker build -t dynajs-artifact .
#   Run:    docker run -it --name dynajs dynajs-artifact
#   See README.md ("Run with Docker") for how to attach and run each tool.
#
# Node versions (managed with nvm):
#   * node 24     — DynaJS & NodeMedic. The built analyses are ES modules loaded
#                   via require(), which needs require(esm) support (node 22+);
#                   node 21.7.2 fails with ERR_REQUIRE_ESM.
#   * node 21.7.2 — ExpoSE only (its package.json pins node ^21.7.2), used just
#                   for `./install` as noted in README.

FROM debian:bookworm

SHELL ["/bin/bash", "-c"]
ENV DEBIAN_FRONTEND=noninteractive
# let the pip3 call inside NodeMedic's setup-deps.sh write to the system env
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# ---- System toolchain (README "Requirements") ----
#   python3/pip, z3, clang+gcc/make -> DynaJS / NodeMedic / ExpoSE
#   JDK                             -> Extractor (Scala/esmeta)
#   git/curl/graphviz               -> fetching deps, NodeMedic graphs
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git bash \
      python3 python3-pip \
      z3 libz3-dev \
      clang gcc g++ make build-essential \
      openjdk-17-jdk-headless \
      graphviz xz-utils unzip \
    && rm -rf /var/lib/apt/lists/*

# ---- sbt (extractor build.sbt pins sbt 1.10.11 / scala 3.3.6; sbt fetches scala itself) ----
RUN curl -fsSL https://github.com/sbt/sbt/releases/download/v1.10.11/sbt-1.10.11.tgz \
      | tar -xz -C /opt
ENV PATH="/opt/sbt/bin:${PATH}"

# ---- nvm + node versions ----
ENV NVM_DIR=/root/.nvm
ENV NODE_DEFAULT=24
ENV NODE_EXPOSE=21.7.2
RUN curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash \
 && . "$NVM_DIR/nvm.sh" \
 && nvm install "$NODE_DEFAULT" \
 && nvm install "$NODE_EXPOSE" \
 && nvm alias default "$NODE_DEFAULT"

# ---- Environment variables (README "How to install") ----
ENV DYNAJS_ARTIFACT_HOME=/artifact
ENV DYNAJS_HOME=$DYNAJS_ARTIFACT_HOME/dynajs
ENV DYNAJS_EXTRACTOR_HOME=$DYNAJS_ARTIFACT_HOME/extractor
ENV ESMETA_HOME=$DYNAJS_ARTIFACT_HOME/extractor
ENV NODEMEDIC_HOME=$DYNAJS_ARTIFACT_HOME/nodemedic
ENV EXPOSE_HOME=$DYNAJS_ARTIFACT_HOME/expose

WORKDIR $DYNAJS_ARTIFACT_HOME
COPY . .

# ---- DynaJS (README "DynaJS") ----
RUN . "$NVM_DIR/nvm.sh" && nvm use "$NODE_DEFAULT" \
 && cd "$DYNAJS_HOME" && npm install && npm run build

# ---- Extractor (README "Extractor") ----
# `sbt compile` only needs the Scala sources; the ecma262/test262 submodules are
# runtime spec resources (needed to *run* extraction, not to compile it).
RUN cd "$DYNAJS_EXTRACTOR_HOME" && sbt -batch compile

# ---- NodeMedic (README "NodeMedic": npm install && npm run local-setup) ----
RUN . "$NVM_DIR/nvm.sh" && nvm use "$NODE_DEFAULT" \
 && cd "$NODEMEDIC_HOME" && npm install && npm run local-setup

# ---- ExpoSE (README "ExpoSE": ./install) — run under the lower node version ----
# ExpoSE's Analyser postinstall clones z3javascript over SSH (git@github.com:),
# which cannot authenticate inside the image. Rewrite GitHub SSH URLs to HTTPS so
# the clone (and the z3 native binding build it triggers) succeeds.
RUN git config --global --add url."https://github.com/".insteadOf "git@github.com:" \
 && git config --global --add url."https://github.com/".insteadOf "ssh://git@github.com/"
RUN . "$NVM_DIR/nvm.sh" && nvm use "$NODE_EXPOSE" \
 && cd "$EXPOSE_HOME" && ./install

# Make sbt reachable from interactive login shells (nvm resets PATH, dropping
# /opt/sbt/bin; /usr/local/bin stays on PATH).
RUN ln -sf /opt/sbt/bin/sbt /usr/local/bin/sbt

# Land in the DynaJS root with the default (node 22) toolchain active.
WORKDIR $DYNAJS_HOME
CMD ["/bin/bash", "-l"]
