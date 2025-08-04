import mongoose from "mongoose";
export default async function () {
    return mongoose.models['hulu.hookup'].aggregate([
        {
            $match: {
                MachineFamilyID: 2,
                HookupName: { $not: { $in: [/CAS/i, /HAN/i] } }
            }
        },
        {
            $lookup: {
                from: 'hulu.scope',
                localField: 'ScopeSfamId',
                foreignField: 'ScopeFamilyId',
                as: 'scopeData'
            }
        },
        {
            $unwind: {
                path: '$scopeData',
                preserveNullAndEmptyArrays: false
            }
        },
        {
            $group: {
                _id: '$_id', // Hookup _id
                HookupName: { $first: '$HookupName' },
                MachineFamilyID: { $first: '$MachineFamilyID' },
                ScopeModel: { $first: '$scopeData.ScopeModel' },
                ScopeModelId: { $first: '$scopeData.ScopeModelId' },
                ScopeType: { $first: '$scopeData.ScopeType' },
                ManufacturerName: { $first: '$scopeData.ManufacturerName' },
                ScopeFamily: { $first: '$scopeData.ScopeFamily' },
                ScopeFamilyId:{ $first: '$scopeData.ScopeFamilyId' }
            }
        },
        {
            $project: {
                _id: 0,
                HookupName: 1,
                MachineFamilyID: 1,
                ScopeModel: 1,
                ScopeModelId: 1,
                ScopeType: 1,
                ManufacturerName: 1,
                ScopeFamily: 1,
                ScopeFamilyId: 1
            }
        }
    ])

}