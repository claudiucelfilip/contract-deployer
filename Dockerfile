FROM instrumentisto/rust:beta

WORKDIR /root
RUN apt-get update
RUN apt-get -y install nodejs npm
RUN rustup target add wasm32-unknown-unknown
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

RUN npm i

RUN cargo --version
EXPOSE 3010
CMD ["npm", "run", "server"]