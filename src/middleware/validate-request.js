// Middleware Job : validates the request parts(body, params, query) against the provided schema.

const validateRequest = schema => async (req, _res, next) => {
  // we save parsed data because zod schemas often modify input data.
  // `parseAsync()` supports schemas that contains async validations. 
  req.validatedData = await schema.parseAsync({
    body: req.body,
    query: req.query,
    params: req.params
  });

  // continue...
  next(); 
};

export default validateRequest;