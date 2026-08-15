export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues?.[0]?.message;
      return res.status(400).json({
        error: firstIssue || "Datos invalidos",
        details: result.error.flatten()
      });
    }
    req.body = result.data;
    return next();
  };
}
