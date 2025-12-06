/**
 * Shared Helper Functions
 */

/**
 * Convert name to key (e.g., "Care Instructions" -> "care_instructions")
 * @param {string} name - Name to convert
 * @returns {string} - Key format
 */
function nameToKey(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

module.exports = {
  nameToKey,
};

