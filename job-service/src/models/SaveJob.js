import mongoose from "mongoose";

const saveJobSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job",
        required: true
    },
    savedDate: {
        type: Date,
        default: Date.now
    }
}, 
{
    timestamps: true
})

saveJobSchema.index({userId: 1, jobId: 1}, {unique: true});

const SaveJob = mongoose.model("SaveJob", saveJobSchema);

export default SaveJob;
