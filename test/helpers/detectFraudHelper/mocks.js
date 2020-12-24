exports.handleImagesData = ({
  exifCounter, photoWidth, photoDates, models, latitudeArr, longitudeArr,
} = {}) => ({
  exifCounter: exifCounter || 0,
  photoWidth: photoWidth || [],
  photoDates: photoDates || [],
  models: models || [],
  latitudeArr: latitudeArr || [],
  longitudeArr: longitudeArr || [],
});
