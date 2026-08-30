const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Middleware factory to validate that a path parameter matches a UUID format.
 * @param {string} [paramName='id'] Name of the path parameter to validate.
 * @returns {Function} Express middleware.
 */
function validateUuid(paramName = 'id') {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!value || !UUID_REGEX.test(value)) {
      return res.status(400).json({ error: 'Invalid ID format.' });
    }
    next();
  };
}

module.exports = {
  validateUuid,
};
