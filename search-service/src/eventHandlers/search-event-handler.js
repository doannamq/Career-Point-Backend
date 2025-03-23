import Search from "../models/Search.js";
import logger from "../utils/logger.js";

async function handleJobCreated(event) {
  try {
    const newJob = new Search({
      jobSlug: event.jobSlug,
      company: event.company,
      location: event.location,
      salary: event.salary,
      experience: event.experience,
      skills: event.skills,
      jobType: event.jobType,
      postedBy: event.postedBy,
      createdAt: event.createdAt,
    });

    await newJob.save();

    logger.info(`Search job created: ${event.jobSlug}`);
  } catch (error) {
    logger.error(error, "Error handling post creation event");
  }
}

async function handleJobDeleted(event) {
  try {
    await Search.findOneAndDelete({ jobSlug: event.jobSlug });
    logger.info(`Search job deleted: ${event.jobSlug}`);
  } catch (error) {
    logger.error(error, "Error handling delete event");
  }
}

export { handleJobCreated, handleJobDeleted };
