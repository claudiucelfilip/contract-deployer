FROM instrumentisto/rust:beta

WORKDIR ~
# RUN apt-get install curl
# RUN apt-get install python
# RUN apt-get install build-dependencies build-base gcc wget git
# RUN apt-get install make
RUN apt-get update
RUN apt-get -y install nodejs npm
RUN rustup target add wasm32-unknown-unknown
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
COPY package.json *.js wavelet-client-2.0.0-rc.5.tgz ./
RUN npm i

RUN cargo --version
EXPOSE 3010
CMD ["npm", "run", "server"]