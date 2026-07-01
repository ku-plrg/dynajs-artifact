# Node.js v20
# Debian Bookworm
FROM node:20-bookworm

# Set up the working directory
WORKDIR /nodetaint

# Install essential packages
RUN apt-get -qq update && \
    apt-get install -qqy bash make vim git graphviz wget unzip

# Install latest z3
RUN wget https://github.com/Z3Prover/z3/releases/download/z3-4.8.9/z3-4.8.9-x64-ubuntu-16.04.zip
RUN unzip z3-4.8.9-x64-ubuntu-16.04.zip
RUN mv z3-4.8.9-x64-ubuntu-16.04 z3
RUN cd z3 && echo "export PATH=$PATH:$(pwd)/bin" >> /root/.bashrc

# Install benchmarking tool
RUN wget https://github.com/sharkdp/hyperfine/releases/download/v1.11.0/hyperfine_1.11.0_amd64.deb
RUN dpkg -i hyperfine_1.11.0_amd64.deb

# Set up node environment
RUN npm i -g n typescript@4.9.5

# Set up python environment
RUN apt-get install -y make build-essential
RUN apt-get --allow-releaseinfo-change update
RUN apt-get install -y libssl-dev zlib1g-dev \
    libbz2-dev libreadline-dev libsqlite3-dev wget curl llvm libncurses5-dev \
    libncursesw5-dev xz-utils tk-dev libffi-dev liblzma-dev
RUN curl https://pyenv.run | bash
RUN echo 'export PATH="/root/.pyenv/bin:$PATH"' >> /root/.bashrc
RUN echo 'eval "$(pyenv init -)"' >> /root/.bashrc
RUN echo 'eval "$(pyenv virtualenv-init -)"' >> /root/.bashrc
ENV PYENV_ROOT="/root/.pyenv"
ENV PATH="${PYENV_ROOT}/shims:${PYENV_ROOT}/bin:${PATH}"
ENV PYTHON_VERSION=3.11.4
RUN pyenv install ${PYTHON_VERSION}
RUN pyenv global ${PYTHON_VERSION} 

RUN apt-get install -y rsync

# Copy over files
COPY lib ./lib
COPY src ./src
COPY tests ./tests
COPY test_pipeline ./test_pipeline
COPY package*.json ./
COPY tsconfig.json .
COPY Makefile .
COPY pipeline ./pipeline

# Set up dependencies and libraries
RUN npm i
RUN cd pipeline && npm i
RUN cd lib && ./setup-deps.sh

# Set up analysis
RUN make clean && make
RUN mkdir analysisArtifacts

# Save a few runtime seconds by pre-compiling .ts files
RUN cd pipeline && tsc -b
RUN tsc -b

# Hand over to bash for interactive usage
COPY entrypoint.sh ./entrypoint.sh
CMD ["/bin/bash"]

# ENTRYPOINT ["./entrypoint.sh"] 
