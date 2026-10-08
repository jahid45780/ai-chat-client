'use client';
import {createContext,useContext,useEffect,useState,ReactNode} from 'react';import {User} from '@/types';import {authApi} from '@/lib/api/auth';
interface AuthContextValue{user:User|null;loading:boolean;refresh:()=>Promise<User|null>;logout:()=>Promise<void>;}
const AuthContext=createContext<AuthContextValue|undefined>(undefined);
export function AuthProvider({children}:{children:ReactNode}){const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true);const refresh=async()=>{try{const u=await authApi.me();setUser(u);return u;}catch{setUser(null);return null;}finally{setLoading(false);}};useEffect(()=>{let active=true;authApi.me().then(u=>{if(active)setUser(u);}).catch(()=>{if(active)setUser(null);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);const logout=async()=>{await authApi.logout();setUser(null);};return <AuthContext.Provider value={{user,loading,refresh,logout}}>{children}</AuthContext.Provider>;}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used within AuthProvider');return value;}
