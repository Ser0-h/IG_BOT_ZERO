const { handleCommand } = require('./commandHandler');
const errorHandler = require('./errorHandler');

/**
 * Composes the middleware chain (auth -> permissions -> cooldown -> ...)
 * then, if nothing short-circuited it, tries to run it as a command.
 */
function composeMiddleware(middlewares) {
  return function run(ctx, final) {
    let i = -1;
    function dispatch(index) {
      if (index <= i) return Promise.reject(new Error('next() called multiple times'));
      i = index;
      const fn = middlewares[index] || final;
      if (!fn) return Promise.resolve();
      return Promise.resolve(fn(ctx, () => dispatch(index + 1)));
    }
    return dispatch(0);
  };
}

function createMessageHandler({ middlewares, commands, prefix }) {
  const runMiddleware = composeMiddleware(middlewares);

  return async function onMessage(ctx) {
    try {
      await runMiddleware(ctx, async () => {
        await handleCommand(ctx, commands, prefix);
      });
    } catch (err) {
      errorHandler.handle(err, 'messageHandler');
    }
  };
}

module.exports = { createMessageHandler };
