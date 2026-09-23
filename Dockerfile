# syntax=docker/dockerfile:1
#
# Standalone MutantcatOffice CLI image. The image is a headless build of
# packages/cli with the same Resources-style layout the app ships, so the
# CLI's own asset lookup finds pdfium and the xlsx sidecar. Commands that
# render or convert through the GUI renderer (render, convert to PDF,
# create --type pdf) still need a running app binary — point
# GENOFFICE_APP_BIN at one, or run those commands on the desktop app.
FROM node:22-bookworm-slim AS build

WORKDIR /work

# No build script in this monorepo needs Electron's downloaded binary; the
# CLI bundles it as an external. Skipping the postinstall avoids pulling the
# ~100 MB runtime into the CI image build.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates pkg-config build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm ci --ignore-scripts

# Install a current Rust toolchain for the xlsx-sidecar (the crate's
# edition/features can outrun Debian's packaged cargo).
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

RUN npm run build -w @genoffice/cli
RUN npm run native:build -w @genoffice/sheets

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /opt/mutantcatoffice

COPY --from=build /work/packages/cli/dist ./cli
COPY --from=build /work/packages/cli/bin/genoffice ./cli/genoffice
COPY --from=build /work/packages/cli/bin/genoffice.cmd ./cli/genoffice.cmd
COPY --from=build /work/packages/cli/package.json ./cli/package.json
COPY --from=build /work/skills/genoffice ./cli/skills/genoffice
COPY --from=build /work/node_modules/@embedpdf/pdfium/dist/pdfium.wasm ./wasm/pdfium.wasm
COPY --from=build /work/apps/pdf/node_modules/harfbuzzjs/hb-subset.wasm ./wasm/hb-subset.wasm
COPY --from=build /work/apps/sheets/native/xlsx-engine/target/release/xlsx-sidecar ./native/xlsx-sidecar

ENTRYPOINT ["node", "/opt/mutantcatoffice/cli/genoffice.cjs"]
CMD ["--help"]
