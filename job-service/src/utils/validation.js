import Joi from "joi";

const validateCreateJob = (data) => {
  const schema = Joi.object({
    title: Joi.string().min(5).required(),
    description: Joi.string().min(10).required(),
    company: Joi.string().required(),
    location: Joi.string().required(),
    salary: Joi.number().required(),
    skills: Joi.array().items(Joi.string()).required(),
    experience: Joi.string(),
    jobType: Joi.string().required(),
  });

  return schema.validate(data);
};

export default validateCreateJob;
