import axios from 'axios';
import { signOut } from 'next-auth/react';
import { toast } from 'react-hot-toast';

// const RegisterApi = async(formData)=>{

//     try {

//         const response = await axios.post('http://localhost:5001/api/auth/register', formData);
//         return response;
//       } catch (error) {
//         // console.error('Error during registration:', error.response?.data || error.message);
//         // throw error;
//       }
// }
// export default RegisterApi
export default async function RegisterApi(formData) {

    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}auth/register`, formData);
      return {response,error:null};
    } catch (error) {
      return {response:null,error};
    //   console.error('Error during registration:', error.response?.data || error.message);
      // throw error;
    }
  }


  // export  async function VerifyEmailApi(){
  //   try{
  //     const response = await axios.post('auth/verify-email?token=d6d75e40c0a3d4cfcea0ee359031f130a6be7650a3a5cee964f45e15d00c7dde')
  //     return response
  //   }catch(error){
  //   }
  // }

  export async function Logout(session) {

    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}auth/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
          },
        }
      );
      if (res.status === 200) {
        // Backend logout successful, now sign out from NextAuth
        toast.success('Logout successful');
        await signOut({ callbackUrl: '/login' });
      } else {
        console.warn('Unexpected logout response:', res.status);
        // Optional: show a user-facing message or retry logic
      }
    } catch (err) {
      // Do NOT call signOut here — backend logout failed
      // Optionally alert user
      toast.error('something went wrong please login again');
      await signOut({ callbackUrl: '/login' });
    }

    // try {
    //   await axios.post(`${process.env.NEXT_PUBLIC_API_URL}auth/logout`, {}, {
    //     headers: {
    //       // include token if needed
    //       Authorization:`Bearer 74e37a94ad5f745015c1d44ba7f17d92d4fba666722abb47d71a34dd348da4`, // or get it from NextAuth session
    //     },
    //   });
    //   //${session?.accessToken}
    //   // After successful backend logout, sign out client
    //   await signOut({ callbackUrl: '/login' }); // Redirect to login after logout
    // } catch (error) {
    //   console.error('Logout failed:', error);
    //   // Even if API call fails, you can still sign out
    //   await signOut({ callbackUrl: '/login' });
    // }
  }