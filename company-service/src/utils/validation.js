import Joi from "joi";

const addressSchema = Joi.object({
  street: Joi.string().required(),
  ward: Joi.string().required(),
  district: Joi.string().required(),
  city: Joi.string().required(),
  // country: Joi.string().required().default("Việt Nam"),
});

const contactSchema = Joi.object({
  email: Joi.string().email().required(),
  phone: Joi.string().required(),
  website: Joi.string().uri().allow(""),
});

const recruitmentContactSchema = Joi.object({
  name: Joi.string().allow(""),
  email: Joi.string().email().allow(""),
  phone: Joi.string().allow(""),
});

const socialMediaSchema = Joi.object({
  facebook: Joi.string().uri().allow(""),
  linkedin: Joi.string().uri().allow(""),
  twitter: Joi.string().uri().allow(""),
  instagram: Joi.string().uri().allow(""),
});

const validateCreateCompany = (data) => {
  const schema = Joi.object({
    name: Joi.string().max(200).required(),
    businessCode: Joi.string().max(100),
    taxCode: Joi.string().max(100),
    industry: Joi.string().required(),
    companySize: Joi.string().required(),
    companyType: Joi.string().required(),
    description: Joi.string().max(2000),
    foundedYear: Joi.number().integer().min(1900).max(new Date().getFullYear()),
    address: addressSchema.required(),
    contact: contactSchema.required(),
    logo: Joi.string().uri().allow(""),
    coverImage: Joi.string().uri().allow(""),
    socialMedia: socialMediaSchema,
    recruitmentContact: recruitmentContactSchema,
    benefits: Joi.array().items(Joi.string()),
    workingHours: Joi.string(),
    tags: Joi.array().items(Joi.string()),
    notes: Joi.string().max(1000),
  });

  return schema.validate(data);
};

export default validateCreateCompany;
