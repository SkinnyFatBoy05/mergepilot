FROM node:24-alpine
RUN addgroup -S evaluator && adduser -S -u 10001 -G evaluator evaluated
WORKDIR /evaluation
COPY --chown=root:root evaluation/oracles /evaluation/oracles
COPY --chown=evaluated:evaluator fixtures /workspace/fixtures
RUN chmod -R 700 /evaluation/oracles && chmod -R 755 /workspace/fixtures
USER evaluated
ENTRYPOINT ["node", "--version"]
