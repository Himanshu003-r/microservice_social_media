import mongoose from "mongoose";
import argon2 from "argon2";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
        type: String,
        required: true
    },
    createdAt:{
        type: Date,
        default: Date.now
    }
  },
  { timestamps: true }
);

userSchema.pre('save', async function(next){
      if(this.isModified('password')){
        try {
            this.password = await argon2.hash(this.password)
        } catch (error) {
            return next(error)
        }
      }
})

userSchema.methods.comparePassword = async function(password){
    try {
        return await argon2.verify(this.password, password)
    } catch (error) {
        throw error
    }
}

userSchema.index({name: 'text'})
const User = mongoose.model('User', userSchema);

export default User;
