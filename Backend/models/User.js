const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs')
module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    login: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    fullName: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    role: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'postgraduate',
      validate: {
        isIn: [['admin', 'postgraduate', 'professor']]
      }
    },
    groupName: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'groups',
        key: 'id'
      }
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    tabNumber: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    position: {
      type: DataTypes.STRING(200),
      allowNull: true
    }
  }, {
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      }
    }
  });
  User.prototype.checkPassword = async function(password) {
    return await bcrypt.compare(password, this.password);
  };
  User.prototype.toSafeJSON = function() {
    const values = { ...this.toJSON() };
    delete values.password;
    return values;
  };
  return User;
};