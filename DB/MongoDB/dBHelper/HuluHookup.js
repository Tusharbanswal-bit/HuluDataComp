import mongoose from "mongoose";
export default async function () {
    return mongoose.models['hulu.scope'].aggregate([
        {
            $lookup: {
                from: 'hulu.hookup',
                localField: 'ScopeFamilyId',
                foreignField: 'ScopeSfamId',
                as: 'hookupData'
            }
        },
        {
            $unwind: {
                path: '$hookupData',
                preserveNullAndEmptyArrays: true // This ensures that records without a match in hookupData still appear
            }
        },
        {
            $match: {
                'hookupData.MachineFamilyID': 2, // This ensures that records without ScopeModelId in hookupData are included
                'hookupData.HookupName': { $not: { $in: [/CAS/i, /HAN/i] } }
            }
        },
        {
            $project: {
                MachineFamilyID: '$hookupData.MachineFamilyID',
                ManufacturerName: 1,
                ScopeType: 1,
                ScopeModel: 1,
                ScopeFamily: 1,
                ScopePerBasin: 1,
                HookupName: '$hookupData.HookupName'
            }
        }
    ]);
}