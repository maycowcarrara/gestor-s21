import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPermitted, setIsPermitted] = useState(false);

    // Função de Login
    const loginGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Erro login:", error);
            toast.error("Erro ao fazer login Google.");
        }
    };

    // Função de Logout
    const logout = () => {
        signOut(auth);
        setIsPermitted(false);
        toast("Sessão encerrada.");
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setLoading(true);

            if (currentUser) {
                // Verifica se o email está na lista de permitidos no Firestore
                // O truque de segurança: O documento TEM que ter o ID igual ao email
                try {
                    const docRef = doc(db, "acessos", currentUser.email);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        setUser(currentUser);
                        setIsPermitted(true);
                        // toast.success(`Bem-vindo, ${currentUser.displayName}!`);
                    } else {
                        setUser(currentUser);
                        setIsPermitted(false); // Logou, mas não tem permissão
                        toast.error("Seu email não tem permissão de acesso.");
                        signOut(auth); // Desloga automaticamente por segurança
                    }
                } catch (error) {
                    // Se der erro aqui, é provável que as regras de segurança já tenham bloqueado
                    // o acesso a leitura, significando que não está permitido.
                    console.error("Erro permissão:", error);
                    setIsPermitted(false);
                    signOut(auth);
                }
            } else {
                setUser(null);
                setIsPermitted(false);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        user,
        isPermitted,
        loginGoogle,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
            {loading && (
                <div className="h-screen w-screen flex items-center justify-center bg-gray-100 flex-col gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-gray-500 font-medium animate-pulse">Verificando credenciais...</p>
                </div>
            )}
        </AuthContext.Provider>
    );
}