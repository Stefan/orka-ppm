import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MessageRenderer } from '../MessageRenderer'
import type { ChatMessage } from '../../../types/help-chat'

// Mock react-markdown with more detailed markdown parsing for testing
jest.mock('react-markdown', () => {
  return function ReactMarkdown({ children, components }: { children: string, components?: any }) {
    // Parse markdown content for testing
    let content = children
    
    // Headers
    content = content.replace(/^### (.+)$/gm, '<h3>$1</h3>')
    content = content.replace(/^## (.+)$/gm, '<h2>$1</h2>')
    content = content.replace(/^# (.+)$/gm, '<h1>$1</h1>')
    
    // Bold and italic
    content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    content = content.replace(/\*(.+?)\*/g, '<em>$1</em>')
    
    // Code blocks and inline code
    content = content.replace(/```(\w+)?\n([\s\S]*?)\n```/g, '<pre><code class="language-$1">$2</code></pre>')
    content = content.replace(/`(.+?)`/g, '<code>$1</code>')
    
    // Lists
    content = content.replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>')
    content = content.replace(/^-\s(.+)$/gm, '<li>$1</li>')
    content = content.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    
    // Links
    content = content.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    
    // Blockquotes
    content = content.replace(/^>\s(.+)$/gm, '<blockquote>$1</blockquote>')
    
    // Line breaks
    content = content.replace(/\n/g, '<br>')
    
    return <div data-testid="markdown-content" dangerouslySetInnerHTML={{ __html: content }} />
  }
})

jest.mock('remark-gfm', () => ({}))
jest.mock('rehype-highlight', () => ({}))

describe('MessageRenderer - Markdown Rendering', () => {
  const defaultProps = {
    onFeedback: jest.fn(),
    onCopy: jest.fn(),
    onQuickAction: jest.fn(),
    feedbackMessageId: null,
    setFeedbackMessageId: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Markdown Headers', () => {
    it('renders H1 headers correctly', () => {
      const message: ChatMessage = {
        id: 'header-h1',
        type: 'assistant',
        content: '# Main Title\n\nThis is content under the main title.',
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      const markdownContent = screen.getByTestId('markdown-content')
      expect(markdownContent).toContainHTML('<h1>Main Title</h1>')
    })

    it('renders H2 headers correctly', () => {
      const message: ChatMessage = {
        id: 'header-h2',
        type: 'assistant',
        content: '## Section Title\n\nThis is section content.',
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      const markdownContent = screen.getByTestId('markdown-content')
      expect(markdownContent).toContainHTML('<h2>Section Title</h2>')
    })

    it('renders H3 headers correctly', () => {
      const message: ChatMessage = {
        id: 'header-h3',
        type: 'assistant',
        content: '### Subsection Title\n\nThis is subsection content.',
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      const markdownContent = screen.getByTestId('markdown-content')
      expect(markdownContent).toContainHTML('<h3>Subsection Title</h3>')
    })
  })

  describe('Markdown Text Formatting', () => {
    it('renders bold text correctly', () => {
      const message: ChatMessage = {
        id: 'bold-text',
        type: 'assistant',
        content: 'This is **bold text** in the message.',
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      const markdownContent = screen.getByTestId('markdown-content')
      expect(markdownContent).toContainHTML('<strong>bold text</strong>')
    })

    it('renders italic text correctly', () => {
      const message: ChatMessage = {
        id: 'italic-text',
        type: 'assistant',
        content: 'This is *italic text* in the message.',
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      const markdownContent = screen.getByTestId('markdown-content')
      expect(markdownContent).toContainHTML('<em>italic text</em>')
    })

    it('renders inline code correctly', () => {
      const message: ChatMessage = {
        id: 'inline-code',
        type: 'assistant',
        content: 'Use the `npm install` command to install packages.',
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      const markdownContent = screen.getByTestId('markdown-content')
      expect(markdownContent).toContainHTML('<code>npm install</code>')
    })
  })

  describe('Markdown Code Blocks', () => {
    it('renders code blocks with language specification', () => {
      const message: ChatMessage = {
        id: 'code-block',
        type: 'assistant',
        content: '```javascript\nconst project = new Project();\nproject.save();\n```',
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      const markdownContent = screen.getByTestId('markdown-content')
      expect(markdownContent).toContainHTML('<pre><code class="language-javascript">const project = new Project();<br>project.save();</code></pre>')
    })

    it('renders code blocks without language specification', () => {
      const message: ChatMessage = {
        id: 'code-block-no-lang',
        type: 'assistant',
        content: '```\necho "Hello World"\nls -la\n```',
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      const markdownContent = screen.getByTestId('markdown-content')
      expect(markdownContent).toContainHTML('<pre><code class="language-">echo "Hello World"<br>ls -la</code></pre>')
    })
  })

  describe('Markdown Lists', () => {
    it('renders numbered lists correctly', () => {
      const message: ChatMessage = {
        id: 'numbered-list',
        type: 'assistant',
        content: '1. First item\n2. Second item\n3. Third item',
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      const markdownContent = screen.getByTestId('markdown-content')
      expect(markdownContent).toContainHTML('<li>First item</li>')
      expect(markdownContent).toContainHTML('<li>Second item</li>')
      expect(markdownContent).toContainHTML('<li>Third item</li>')
    })

    it('renders bullet lists correctly', () => {
      const message: ChatMessage = {
        id: 'bullet-list',
        type: 'assistant',
        content: '- First bullet\n- Second bullet\n- Third bullet',
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      const markdownContent = screen.getByTestId('markdown-content')
      expect(markdownContent.innerHTML).toContain('<ul>')
      expect(markdownContent).toContainHTML('<li>First bullet</li>')
      expect(markdownContent).toContainHTML('<li>Second bullet</li>')
      expect(markdownContent).toContainHTML('<li>Third bullet</li>')
    })
  })

  describe('Markdown Links', () => {
    it('renders links correctly', () => {
      const message: ChatMessage = {
        id: 'links',
        type: 'assistant',
        content: 'Visit the [documentation](https://example.com/docs) for more information.',
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      const markdownContent = screen.getByTestId('markdown-content')
      expect(markdownContent).toContainHTML('<a href="https://example.com/docs">documentation</a>')
    })
  })

  describe('Markdown Blockquotes', () => {
    it('renders blockquotes correctly', () => {
      const message: ChatMessage = {
        id: 'blockquote',
        type: 'assistant',
        content: '> This is a blockquote\n> with multiple lines',
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      const markdownContent = screen.getByTestId('markdown-content')
      expect(markdownContent).toContainHTML('<blockquote>This is a blockquote</blockquote>')
      expect(markdownContent).toContainHTML('<blockquote>with multiple lines</blockquote>')
    })
  })

  describe('Complex Markdown Content', () => {
    it('renders complex markdown with multiple elements', () => {
      const message: ChatMessage = {
        id: 'complex-markdown',
        type: 'assistant',
        content: `# Project Creation Guide

## Overview
Creating a new project involves **several steps**:

1. Navigate to the *Projects* section
2. Click the \`New Project\` button
3. Fill in the required details

### Code Example
\`\`\`javascript
const project = {
  name: "My Project",
  description: "Project description"
};
\`\`\`

> **Note:** Make sure to save your project after creation.

For more information, visit the [documentation](https://example.com/docs).`,
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      const markdownContent = screen.getByTestId('markdown-content')
      
      // Check headers
      expect(markdownContent).toContainHTML('<h1>Project Creation Guide</h1>')
      expect(markdownContent).toContainHTML('<h2>Overview</h2>')
      expect(markdownContent).toContainHTML('<h3>Code Example</h3>')
      
      // Check formatting
      expect(markdownContent).toContainHTML('<strong>several steps</strong>')
      expect(markdownContent).toContainHTML('<em>Projects</em>')
      expect(markdownContent).toContainHTML('<code>New Project</code>')
      
      // Check list
      expect(markdownContent.innerHTML).toContain('<li>Navigate to the')
      expect(markdownContent.innerHTML).toContain('<li>Click the')
      expect(markdownContent).toContainHTML('<li>Fill in the required details</li>')
      
      // Check code block
      expect(markdownContent.innerHTML).toContain('<pre><code class="language-javascript">')
      
      // Check blockquote
      expect(markdownContent.innerHTML).toContain('<blockquote>')
      
      // Check link
      expect(markdownContent).toContainHTML('<a href="https://example.com/docs">documentation</a>')
    })
  })

  describe('User Message Formatting', () => {
    it('renders user messages as plain text without markdown processing', () => {
      const message: ChatMessage = {
        id: 'user-markdown',
        type: 'user',
        content: '# This should not be a header\n**This should not be bold**\n`This should not be code`',
        timestamp: new Date(),
      }

      render(<MessageRenderer message={message} {...defaultProps} />)

      // User messages should not process markdown - the content should be in a single paragraph
      const messageContent = screen.getByTestId('markdown-content')
      expect(messageContent).toBeInTheDocument()
      
      // Check that the raw markdown text is present (not processed)
      expect(messageContent.textContent).toContain('# This should not be a header')
      expect(messageContent.textContent).toContain('**This should not be bold**')
      expect(messageContent.textContent).toContain('`This should not be code`')
      
      // Should not contain HTML elements that would indicate markdown processing
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
      expect(messageContent.querySelector('strong')).not.toBeInTheDocument()
      expect(messageContent.querySelector('code')).not.toBeInTheDocument()
    })
  })
})