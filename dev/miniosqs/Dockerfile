FROM mhart/alpine-node:12 as builder

WORKDIR /app

COPY package.json .
COPY tsconfig.json .
COPY yarn.lock ,

COPY ./src ./src

RUN yarn install
RUN yarn build

FROM mhart/alpine-node:12

WORKDIR /app

COPY package.json .
COPY yarn.lock .

RUN yarn install --production

COPY --from=builder /app/dist /app/dist

CMD [ "yarn", "start" ]
