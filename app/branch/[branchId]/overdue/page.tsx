"use client"

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { ArrowLeft, Copy, Check, MessageSquare } from "lucide-react"

interface OverduePayment {
    paymentId: string
    studentId: string
    studentName: string
    phone: string | null
    dueDate: string
    amount: number
}

interface DraftMessage {
    studentName: string
    phone: string | null
    message: string
}

export default function OverduePage() {
    const params = useParams()
    const router = useRouter()
    const branchId = params.branchId as string

    const [loading, setLoading] = useState(true)
    const [payments, setPayments] = useState<OverduePayment[]>([])
    const [drafts, setDrafts] = useState<DraftMessage[]>([])
    const [language, setLanguage] = useState<'EN' | 'HI'>('EN')
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

    useEffect(() => {
        fetchOverdue()
    }, [branchId])

    const fetchOverdue = async () => {
        try {
            const res = await fetch(`/api/branches/${branchId}/payments/overdue`)
            const data = await res.json()
            setPayments(data.payments || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const generateDrafts = () => {
        const newDrafts = payments.map(p => {
            const date = new Date(p.dueDate).toLocaleDateString()
            let message = ""

            if (language === 'EN') {
                message = `Hi ${p.studentName},\nYour payment of ₹${p.amount} due on ${date} is pending.\nPlease clear it at the earliest.\nThank you.`
            } else {
                message = `नमस्ते ${p.studentName},\nआपकी ₹${p.amount} की पेमेंट जो ${date} को देय थी, अभी तक प्राप्त नहीं हुई है.\nकृपया इसे जल्द से जल्द जमा करें.\nधन्यवाद.`
            }

            return {
                studentName: p.studentName,
                phone: p.phone,
                message
            }
        })
        setDrafts(newDrafts)
    }

    const copyToClipboard = (text: string, index: number) => {
        navigator.clipboard.writeText(text)
        setCopiedIndex(index)
        setTimeout(() => setCopiedIndex(null), 2000)
    }

    return (
        <div className="space-y-6 container mx-auto p-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Overdue Payments</h1>
                    <p className="text-muted-foreground">Follow up with students who have missed their due date.</p>
                </div>
            </div>

            {loading ? (
                <Card className="w-full h-64 animate-pulse bg-muted/20">
                    <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>
                </Card>
            ) : (
                <>
                    <Card
                        title={`${payments.length} Overdue Payments`}
                        action={
                            payments.length > 0 && (
                                <div className="flex gap-2">
                                    <select
                                        className="bg-[#0f111a] border border-white/10 rounded-lg px-3 py-1 text-sm text-gray-300 focus:outline-none focus:border-primary/50"
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value as 'EN' | 'HI')}
                                    >
                                        <option value="EN">English</option>
                                        <option value="HI">Hindi</option>
                                    </select>
                                    <Button onClick={generateDrafts} className="gap-2" size="sm">
                                        <MessageSquare className="h-4 w-4" />
                                        Generate Drafts
                                    </Button>
                                </div>
                            )
                        }
                    >
                        <div>
                            {payments.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground">
                                    No overdue payments found.
                                </div>
                            ) : (
                                <div className="relative w-full overflow-auto">
                                    <table className="w-full caption-bottom text-sm text-left">
                                        <thead className="[&_tr]:border-b border-white/10">
                                            <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Student</th>
                                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Phone</th>
                                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Due Date</th>
                                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="[&_tr:last-child]:border-0">
                                            {payments.map((p) => (
                                                <tr key={p.paymentId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                    <td className="p-4 align-middle font-medium text-white">{p.studentName}</td>
                                                    <td className="p-4 align-middle text-gray-400">{p.phone || '-'}</td>
                                                    <td className="p-4 align-middle text-gray-400">{new Date(p.dueDate).toLocaleDateString()}</td>
                                                    <td className="p-4 align-middle text-right font-medium text-white">₹{p.amount}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </Card>

                    {drafts.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold text-white">Message Drafts</h2>
                                <Badge variant="warning">
                                    Drafts only. Not sent automatically.
                                </Badge>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {drafts.map((d, i) => (
                                    <Card key={i} className="bg-black/40 border-white/10" title={d.studentName}>
                                        <div className="space-y-4">
                                            <div className="text-xs text-muted-foreground -mt-4 mb-2">{d.phone}</div>
                                            <textarea
                                                readOnly
                                                className="w-full h-32 bg-black/50 rounded-md border border-white/10 p-3 text-sm resize-none focus:outline-none text-gray-300"
                                                value={d.message}
                                            />
                                            <Button
                                                variant="outline"
                                                className="w-full gap-2"
                                                onClick={() => copyToClipboard(d.message, i)}
                                            >
                                                {copiedIndex === i ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                                {copiedIndex === i ? "Copied" : "Copy Message"}
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
