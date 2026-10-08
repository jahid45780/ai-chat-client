'use client';
import {ReactNode,useEffect} from 'react';import {useRouter} from 'next/navigation';import {useAuth} from '@/hooks/useAuth';
export function Protected({children}:{children:ReactNode}){const {user,loading}=useAuth(),router=useRouter();useEffect(()=>{if(!loading&&!user)router.replace('/login');},[loading,user,router]);if(loading||!user)return <div className="screen-loading"><span className="spinner"/>Loading BROKEN AI…</div>;return <>{children}</>;}
