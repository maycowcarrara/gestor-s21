import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, googleProvider } from '../config/firebase';
import {
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'admin' ou 'comum'
    const [loading, setLoading] = useState(true);
    const [isPermitted, setIsPermitted] = useState(false);

    // Função de Login
    const loginGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            // O redirecionamento e verificação acontecem no useEffect abaixo
        } catch (error) {
            console.error("Erro no login:", error);
            toast.error("Erro ao conectar com Google.");
        }
    };

    // Função de Logout
    const logout = async () => {
        try {
            await signOut(auth);
            setUser(null);
            setUserRole(null);
            setIsPermitted(false);
            toast.success("Desconectado.");
        } catch (error) {
            console.error("Erro ao sair:", error);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setLoading(true);

            if (currentUser) {
                try {
                    // FORÇAR EMAIL MINÚSCULO (Crucial para bater com o ID no banco)
                    const emailLower = currentUser.email.toLowerCase();

                    // Tenta buscar o documento do usuário DIRETAMENTE pelo ID (Operação GET permitida)
                    const userRef = doc(db, "usuarios", emailLower);
                    const userSnap = await getDoc(userRef);

                    if (userSnap.exists()) {
                        const userData = userSnap.data();

                        // Sucesso: Usuário existe no banco
                        setUser({ ...currentUser, ...userData }); // Combina dados do Auth com dados do Firestore
                        setUserRole(userData.papel || 'comum');
                        setIsPermitted(true);

                        // Opcional: Atualizar último acesso
                        try {
                            await setDoc(userRef, { ultimo_login: serverTimestamp() }, { merge: true });
                        } catch (writeError) {
                            // Ignora erro de permissão na escrita do log, pois o login em si foi sucesso
                            console.warn("Não foi possível atualizar o último login (permissão de escrita restrita a admins).");
                        }

                    } else {
                        // Falha: Usuário logou no Google, mas não tem documento na coleção 'usuarios'
                        console.warn(`Acesso negado: ${emailLower} não encontrado no banco.`);
                        toast.error("Seu e-mail não tem permissão de acesso.");
                        await signOut(auth);
                        setUser(null);
                        setIsPermitted(false);
                    }
                } catch (error) {
                    console.error("Erro ao verificar permissão:", error);
                    // Se for erro de permissão aqui, é porque a regra de segurança falhou ou o ID está errado
                    if (error.code === 'permission-denied') {
                        toast.error("Erro de permissão. Verifique se seu cadastro está correto (minúsculas).");
                    }
                    await signOut(auth);
                    setUser(null);
                    setIsPermitted(false);
                }
            } else {
                setUser(null);
                setUserRole(null);
                setIsPermitted(false);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        user,
        userRole,
        isPermitted, // Use isso para proteger rotas privadas
        isAdmin: userRole === 'admin',
        loading,
        loginGoogle,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}