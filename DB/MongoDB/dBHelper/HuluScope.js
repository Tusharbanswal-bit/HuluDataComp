export default async function () {
    return this.find({}, {
      ManufacturerName: 1,
      ScopeType: 1,
      ScopeModel: 1,
      ScopeFamily: 1,
      ScopePerBasin: 1
    }).lean();
}

    