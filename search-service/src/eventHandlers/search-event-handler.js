import Search from "../models/Search.js";
import logger from "../utils/logger.js";

async function handleJobCreated(event) {
  try {
    const newJob = new Search({
      jobId: event.jobId,
      slug: event.slug,
      companyName: event.companyName,
      location: event.location,
      salary: event.salary,
      experience: event.experience,
      skills: event.skills,
      jobType: event.jobType,
      postedBy: event.postedBy,
      isFeatured: event.isFeatured,
      createdAt: event.createdAt,
      title: event.title,
      status: event.status,
    });

    await newJob.save();

    logger.info(`Search job created: ${event.slug}`);
  } catch (error) {
    logger.error(error, "Error handling post creation event");
  }
}

async function handleJobDeleted(event) {
  try {
    await Search.findOneAndDelete({ slug: event.slug });
    logger.info(`Search job deleted: ${event.slug}`);
  } catch (error) {
    logger.error(error, "Error handling delete event");
  }
}

async function handleUpdateJobFeatured(event) {
  try {
    await Search.findOneAndUpdate({ slug: event.slug }, { isFeatured: event.isFeatured });
    logger.info(`Search job updated featured: ${event.slug}`);
  } catch (error) {
    logger.error(error, "Error handling update featured event");
  }
}

async function handleUpdateJobHot(event) {
  try {
    await Search.findOneAndUpdate({ slug: event.slug }, { isHot: event.isHot });
    logger.info(`Search job updated hot status: ${event.slug} - isHot: ${event.isHot}`);
  } catch (error) {
    logger.error(error, "Error handling update hot status event");
  }
}

export { handleJobCreated, handleJobDeleted, handleUpdateJobFeatured, handleUpdateJobHot };
