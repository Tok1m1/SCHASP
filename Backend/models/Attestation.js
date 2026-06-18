const { DataTypes } = require('sequelize');
const { ATTESTATION_DECISIONS } = require('../utils/attestationDecisions');

module.exports = (sequelize) => {
  return sequelize.define('Attestation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    periodLabel: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    decision: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        isAllowedDecision(value) {
          if (value != null && value !== '' && !ATTESTATION_DECISIONS.includes(value)) {
            throw new Error('Недопустимое значение decision');
          }
        }
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    attestedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    tableName: 'attestations',
    timestamps: true
  });
};
