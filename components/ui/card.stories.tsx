import type { Meta, StoryObj } from '@storybook/react'
import { Card, CardHeader, CardContent } from './Card'

/**
 * Card component stories
 * 
 * The Card component is a standardized container that implements the design system.
 * It supports configurable padding, shadow, and border options.
 */
const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    padding: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Padding size of the card',
    },
    shadow: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Shadow size of the card',
    },
    border: {
      control: 'boolean',
      description: 'Whether to show a border',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '500px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default card - standard card with medium padding and shadow
 */
export const Default: Story = {
  args: {
    children: (
      <div>
        <h3 className="text-lg font-semibold mb-2 text-gray-900">Card Title</h3>
        <p className="text-gray-600">
          This is a default card with medium padding and shadow.
        </p>
      </div>
    ),
  },
}

/**
 * With header - card with a separated header section
 */
export const WithHeader: Story = {
  args: {
    children: (
      <>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Card with Header</h3>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            This card has a header section separated by a border.
          </p>
        </CardContent>
      </>
    ),
  },
}

/**
 * Small padding - compact card for tight spaces
 */
export const SmallPadding: Story = {
  args: {
    padding: 'sm',
    children: (
      <div>
        <h3 className="text-lg font-semibold mb-2 text-gray-900">Small Padding</h3>
        <p className="text-gray-600">This card has small padding.</p>
      </div>
    ),
  },
}

/**
 * Medium padding - default padding for most use cases
 */
export const MediumPadding: Story = {
  args: {
    padding: 'md',
    children: (
      <div>
        <h3 className="text-lg font-semibold mb-2 text-gray-900">Medium Padding</h3>
        <p className="text-gray-600">This card has medium padding.</p>
      </div>
    ),
  },
}

/**
 * Large padding - spacious card for important content
 */
export const LargePadding: Story = {
  args: {
    padding: 'lg',
    children: (
      <div>
        <h3 className="text-lg font-semibold mb-2 text-gray-900">Large Padding</h3>
        <p className="text-gray-600">This card has large padding.</p>
      </div>
    ),
  },
}

/**
 * Small shadow - subtle elevation
 */
export const SmallShadow: Story = {
  args: {
    shadow: 'sm',
    children: (
      <div>
        <h3 className="text-lg font-semibold mb-2 text-gray-900">Small Shadow</h3>
        <p className="text-gray-600">This card has a small shadow.</p>
      </div>
    ),
  },
}

/**
 * Medium shadow - default elevation
 */
export const MediumShadow: Story = {
  args: {
    shadow: 'md',
    children: (
      <div>
        <h3 className="text-lg font-semibold mb-2 text-gray-900">Medium Shadow</h3>
        <p className="text-gray-600">This card has a medium shadow.</p>
      </div>
    ),
  },
}

/**
 * Large shadow - prominent elevation
 */
export const LargeShadow: Story = {
  args: {
    shadow: 'lg',
    children: (
      <div>
        <h3 className="text-lg font-semibold mb-2 text-gray-900">Large Shadow</h3>
        <p className="text-gray-600">This card has a large shadow.</p>
      </div>
    ),
  },
}

/**
 * With border - card with a visible border
 */
export const WithBorder: Story = {
  args: {
    border: true,
    children: (
      <div>
        <h3 className="text-lg font-semibold mb-2 text-gray-900">Card with Border</h3>
        <p className="text-gray-600">This card has a border.</p>
      </div>
    ),
  },
}

/**
 * All configurations showcase
 */
export const AllConfigurations: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-6" style={{ width: '800px' }}>
      <Card padding="sm" shadow="sm">
        <h4 className="font-semibold mb-1 text-gray-900">Small Padding + Small Shadow</h4>
        <p className="text-sm text-gray-600">Compact card configuration</p>
      </Card>
      
      <Card padding="md" shadow="md">
        <h4 className="font-semibold mb-1 text-gray-900">Medium Padding + Medium Shadow</h4>
        <p className="text-sm text-gray-600">Default card configuration</p>
      </Card>
      
      <Card padding="lg" shadow="lg">
        <h4 className="font-semibold mb-1 text-gray-900">Large Padding + Large Shadow</h4>
        <p className="text-sm text-gray-600">Spacious card configuration</p>
      </Card>
      
      <Card padding="md" shadow="md" border>
        <h4 className="font-semibold mb-1 text-gray-900">With Border</h4>
        <p className="text-sm text-gray-600">Card with visible border</p>
      </Card>
    </div>
  ),
}

/**
 * Complex content example
 */
export const ComplexContent: Story = {
  args: {
    children: (
      <>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-900">Project Dashboard</h3>
            <span className="text-sm text-gray-500">Last updated: 2 hours ago</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 text-gray-900">Progress</h4>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div className="bg-primary-600 h-2 rounded-full" style={{ width: '65%' }}></div>
              </div>
              <p className="text-sm text-gray-600 mt-1">65% complete</p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2 text-gray-900">Team Members</h4>
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-200 flex items-center justify-center text-sm font-medium">
                  JD
                </div>
                <div className="w-8 h-8 rounded-full bg-primary-200 flex items-center justify-center text-sm font-medium">
                  SM
                </div>
                <div className="w-8 h-8 rounded-full bg-primary-200 flex items-center justify-center text-sm font-medium">
                  AK
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2 text-gray-900">Status</h4>
              <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                On Track
              </span>
            </div>
          </div>
        </CardContent>
      </>
    ),
  },
}

/**
 * List of cards example
 */
export const CardList: Story = {
  render: () => (
    <div className="flex flex-col gap-4" style={{ width: '500px' }}>
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Task 1</h3>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Complete the design system implementation</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Task 2</h3>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Write comprehensive tests for all components</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Task 3</h3>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Create Storybook documentation</p>
        </CardContent>
      </Card>
    </div>
  ),
}
