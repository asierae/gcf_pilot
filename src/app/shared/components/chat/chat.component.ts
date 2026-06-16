import { Component, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

const STUB_RESPONSES: { keywords: string[]; response: string }[] = [
  {
    keywords: ['requirement', 'requirements', 'eligibility', 'eligible', 'apply', 'application'],
    response: `To apply through GCF Support, your organization must complete two stages:\n\n**Stage 1** — Pre-screening questionnaire covering legal status, governance, fiduciary capacity and climate finance experience.\n\n**Stage 2** — Full accreditation application with detailed documentation.\n\nWould you like more detail on any specific requirement?`,
  },
  {
    keywords: ['price', 'pricing', 'cost', 'fee', 'fees', 'service', 'package', 'plan'],
    response: `We offer three service tiers:\n\n• **Advisory** — Document review & feedback\n• **Full Support** — End-to-end application management\n• **Premium** — Dedicated consultant + Stage 2 preparation\n\nContact us at support@gcf-support.org for a tailored quote.`,
  },
  {
    keywords: ['stage 1', 'stage1', 'pre-screening', 'prescreening', 'questionnaire'],
    response: `Stage 1 is the pre-screening questionnaire. It covers:\n• Organizational structure & legal status\n• Governance & fiduciary capacity\n• Climate finance experience\n• NDA/consultation records (if applicable)\n\nReview typically takes 5–10 business days.`,
  },
  {
    keywords: ['stage 2', 'stage2', 'full accreditation', 'full form', 'accreditation form'],
    response: `Stage 2 is the full GCF accreditation application. It requires detailed documentation including:\n• Audited financial statements (3 years)\n• HR and procurement policies\n• Environmental & social safeguard systems\n• Project track record evidence\n\nAvailable to organizations that pass Stage 1 review.`,
  },
  {
    keywords: ['document', 'documents', 'upload', 'file', 'files', 'attach', 'attachment'],
    response: `Required documents vary by stage:\n\n**Stage 1:** Nomination letter (if applicable), consultation summary, legal supporting documents.\n\n**Stage 2:** Audited accounts, HR policies, ESMS documentation, fast-track accreditation references (if applicable).`,
  },
  {
    keywords: ['timeline', 'time', 'duration', 'how long', 'long', 'process', 'months', 'years'],
    response: `The full GCF accreditation process typically takes **12–24 months** from submission to final decision.\n\n• Stage 1 internal review: 5–10 days\n• Stage 2 GCF Secretariat review: 12–24 months\n\nTimelines depend on application completeness and GCF Secretariat workload.`,
  },
  {
    keywords: ['nda', 'national designated authority', 'nomination', 'government'],
    response: `For direct access entities, an NDA (National Designated Authority) endorsement letter is required. The NDA is the government body responsible for GCF activities in your country.\n\nFor international access entities (self-nominating), the NDA letter is not required.`,
  },
  {
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'hola', 'help'],
    response: `Hello! 👋 I'm the GCF Support assistant. I can help you with:\n\n• Eligibility requirements for GCF accreditation\n• Information about Stage 1 and Stage 2\n• Required documents\n• Timelines and processes\n• Service pricing\n\nWhat would you like to know?`,
  },
];

const FALLBACK = `I don't have a specific answer for that yet. Our team will be happy to help — please contact us at **support@gcf-support.org** or use the form on our website.\n\nI can answer questions about eligibility requirements, application stages, required documents, timelines, and service pricing.`;

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
})
export class ChatComponent implements AfterViewChecked {
  @ViewChild('messagesEnd') private messagesEnd!: ElementRef<HTMLDivElement>;

  isOpen = false;
  inputText = '';
  thinking = false;
  messages: ChatMessage[] = [
    {
      id: 'welcome',
      role: 'agent',
      text: `Hello! 👋 I'm the GCF Support assistant. Ask me anything about the accreditation process, eligibility requirements, documentation, timelines or our service plans.`,
      timestamp: new Date(),
    },
  ];

  private shouldScroll = false;

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.shouldScroll = true;
    }
  }

  closeChat(): void {
    this.isOpen = false;
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  async sendMessage(): Promise<void> {
    const text = this.inputText.trim();
    if (!text || this.thinking) return;

    this.inputText = '';
    this.addMessage('user', text);

    this.thinking = true;
    this.shouldScroll = true;

    // Simulate network delay (replace with real Gemini call later)
    await new Promise<void>((resolve) => setTimeout(resolve, 900 + Math.random() * 600));

    const response = this.getStubResponse(text);
    this.addMessage('agent', response);
    this.thinking = false;
    this.shouldScroll = true;
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.sendMessage();
    }
  }

  formatText(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  private addMessage(role: 'user' | 'agent', text: string): void {
    this.messages.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      text,
      timestamp: new Date(),
    });
  }

  private getStubResponse(input: string): string {
    const lower = input.toLowerCase();
    for (const entry of STUB_RESPONSES) {
      if (entry.keywords.some((kw) => lower.includes(kw))) {
        return entry.response;
      }
    }
    return FALLBACK;
  }

  private scrollToBottom(): void {
    try {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }
}
