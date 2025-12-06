const { getMetafieldDefinition, updateMetafieldDefinition, findDefinitionIdByName } = require('./metafield-functions');

/**
 * Metafield Choices Functions
 * Functions for managing choices (validation values) for metafield definitions
 */

/**
 * Resolve definition ID from identifier (can be ID or name)
 * @param {string} identifier - Definition ID or name
 * @param {string} namespace - Namespace (default: "custom")
 * @param {string} ownerType - Owner type (default: "PRODUCT")
 * @returns {Promise<string>} - Definition ID
 */
async function resolveDefinitionId(identifier, namespace = 'custom', ownerType = 'PRODUCT') {
  if (identifier.startsWith('gid://')) {
    return identifier;
  }
  
  const definitionId = await findDefinitionIdByName(identifier, namespace, ownerType);
  if (!definitionId) {
    throw new Error(`Metafield definition not found: "${identifier}" (namespace: ${namespace}, ownerType: ${ownerType})`);
  }
  
  return definitionId;
}

/**
 * Get choices from metafield definition
 * @param {string} identifier - Definition ID or name
 * @param {string} namespace - Namespace (default: "custom")
 * @param {string} ownerType - Owner type (default: "PRODUCT")
 * @returns {Promise<Array<string>>} - Array of choices
 */
async function getChoices(identifier, namespace = 'custom', ownerType = 'PRODUCT') {
  const definitionId = await resolveDefinitionId(identifier, namespace, ownerType);
  const definition = await getMetafieldDefinition(definitionId);
  
  const choicesValidation = definition.validations?.find(v => v.name === 'choices');
  if (!choicesValidation) {
    return [];
  }
  
  try {
    return JSON.parse(choicesValidation.value || '[]');
  } catch (error) {
    console.warn('⚠️  Could not parse choices, returning empty array');
    return [];
  }
}

/**
 * Set choices (replace all)
 * @param {string} identifier - Definition ID or name
 * @param {Array<string>} choices - New choices array
 * @param {string} namespace - Namespace (default: "custom")
 * @param {string} ownerType - Owner type (default: "PRODUCT")
 * @returns {Promise<Object>} - Updated definition
 */
async function setChoices(identifier, choices, namespace = 'custom', ownerType = 'PRODUCT') {
  if (!Array.isArray(choices)) {
    throw new Error('Choices must be an array');
  }

  const definitionId = await resolveDefinitionId(identifier, namespace, ownerType);
  
  const definition = await getMetafieldDefinition(definitionId);
  const currentValidations = definition.validations || [];
  
  const updatedValidations = currentValidations.filter(v => v.name !== 'choices');
  updatedValidations.push({
    name: 'choices',
    value: JSON.stringify(choices)
  });

  return await updateMetafieldDefinition(definitionId, {
    validations: updatedValidations
  });
}

/**
 * Add choices
 * @param {string} identifier - Definition ID or name
 * @param {string|Array<string>} newChoices - Choice(s) to add
 * @param {string} namespace - Namespace (default: "custom")
 * @param {string} ownerType - Owner type (default: "PRODUCT")
 * @returns {Promise<Object>} - Updated definition
 */
async function addChoices(identifier, newChoices, namespace = 'custom', ownerType = 'PRODUCT') {
  const currentChoices = await getChoices(identifier, namespace, ownerType);
  const choicesToAdd = Array.isArray(newChoices) ? newChoices : [newChoices];
  
  const updatedChoices = [...new Set([...currentChoices, ...choicesToAdd])];
  
  return await setChoices(identifier, updatedChoices, namespace, ownerType);
}

/**
 * Remove choices
 * @param {string} identifier - Definition ID or name
 * @param {string|Array<string>} choicesToRemove - Choice(s) to remove
 * @param {string} namespace - Namespace (default: "custom")
 * @param {string} ownerType - Owner type (default: "PRODUCT")
 * @returns {Promise<Object>} - Updated definition
 */
async function removeChoices(identifier, choicesToRemove, namespace = 'custom', ownerType = 'PRODUCT') {
  const currentChoices = await getChoices(identifier, namespace, ownerType);
  const choicesToDelete = Array.isArray(choicesToRemove) ? choicesToRemove : [choicesToRemove];
  
  const updatedChoices = currentChoices.filter(choice => !choicesToDelete.includes(choice));
  
  return await setChoices(identifier, updatedChoices, namespace, ownerType);
}

module.exports = {
  getChoices,
  setChoices,
  addChoices,
  removeChoices,
  resolveDefinitionId,
};

