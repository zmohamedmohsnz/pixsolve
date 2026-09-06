// this middleware validates the request against the provided schema
const validate = schema => async (req, _res, next) => {
  // - we save the parsed data because zod schemas usually modify the input data
  // - `parseAsync()` supports schemas contains async validations 
  req.validated = await schema.parseAsync({
    body: req.body,
    query: req.query,
    params: req.params
  });

  // continue..
  next();
};

export default validate;